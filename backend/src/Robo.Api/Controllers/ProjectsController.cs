using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Robo.Api.Auth;
using Robo.Api.Contracts;
using Robo.Api.Data;
using Robo.Api.Data.Entities;
using Robo.Api.Errors;
using Robo.Api.Mapping;
using Robo.Core.Contracts;

namespace Robo.Api.Controllers;

/// <summary>
/// Проекты текущего пользователя. Владелец — по UserId из токена; чужой проект неотличим от
/// несуществующего (404), в том числе для admin.
/// </summary>
[Authorize]
[ApiController]
[Route("api/v1/projects")]
public class ProjectsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EngineConfig _config;

    public ProjectsController(AppDbContext db, EngineConfig config)
    {
        _db = db;
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllProjects()
    {
        var userId = User.UserId();
        // lastPaybackYears — из последнего расчёта проекта
        var list = await _db.Projects.AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => new ProjectSummary(
                p.Id, p.Name, p.ObjectType, p.UpdatedAt,
                _db.CalculationResults
                    .Where(c => c.ProjectId == p.Id)
                    .OrderByDescending(c => c.CreatedAt)
                    .Select(c => c.BestPaybackYears)
                    .FirstOrDefault()))
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProject([FromBody] ProjectRequest request)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return ApiResults.Invalid(errors);

        var now = ApiTime.Now();
        var project = new Project { Id = Guid.NewGuid().ToString(), UserId = User.UserId(), CreatedAt = now };
        Apply(project, request, now);
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();
        return StatusCode(201, project.ToResponse());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProject(string id)
    {
        var project = await FindOwnAsync(id);
        return project == null ? ApiResults.NotFound("Проект") : Ok(project.ToResponse());
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProject(string id, [FromBody] ProjectRequest request)
    {
        var project = await FindOwnAsync(id);
        if (project == null) return ApiResults.NotFound("Проект");

        var errors = Validate(request);
        if (errors.Count > 0) return ApiResults.Invalid(errors);

        Apply(project, request, ApiTime.Now());
        await _db.SaveChangesAsync();
        return Ok(project.ToResponse());
    }

    /// <summary>Удаление проекта; его расчёты удаляет каскад внешнего ключа calculations → projects.</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(string id)
    {
        var project = await FindOwnAsync(id);
        if (project == null) return ApiResults.NotFound("Проект");

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Копия: новый id, « (копия)» к названию, даты — сейчас. Расчёты не копируются.</summary>
    [HttpPost("{id}/copy")]
    public async Task<IActionResult> CopyProject(string id)
    {
        var source = await FindOwnAsync(id);
        if (source == null) return ApiResults.NotFound("Проект");

        var now = ApiTime.Now();
        var copy = new Project
        {
            Id = Guid.NewGuid().ToString(),
            UserId = source.UserId,
            Name = source.Name + " (копия)",
            ObjectType = source.ObjectType,
            Params = new Dictionary<string, JsonElement>(source.Params),
            Assumptions = source.Assumptions,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Projects.Add(copy);
        await _db.SaveChangesAsync();
        return StatusCode(201, copy.ToResponse());
    }

    private Task<Project?> FindOwnAsync(string id)
    {
        var userId = User.UserId();
        return _db.Projects.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
    }

    private List<ErrorDetail> Validate(ProjectRequest r)
    {
        var errors = new List<ErrorDetail>();
        if (string.IsNullOrWhiteSpace(r.Name))
            errors.Add(new ErrorDetail { Field = "name", Message = "Укажите название проекта", Hint = "Например: «Склад Подольск — роботизация приёмки»" });
        if (_config.ObjectTypes.All(t => t.Code != r.ObjectType))
            errors.Add(new ErrorDetail { Field = "objectType", Message = "Выберите тип объекта из списка" });
        // ParamValue: число, строка, boolean или null — вложенные объекты и массивы не принимаются
        foreach (var (key, value) in r.Params ?? [])
            if (value.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
                errors.Add(new ErrorDetail { Field = $"params.{key}", Message = "Значение параметра должно быть числом, строкой, да/нет или пустым" });
        if (r.Assumptions == null)
            errors.Add(new ErrorDetail { Field = "assumptions", Message = "Укажите допущения расчёта" });
        return errors;
    }

    // Вызывается после Validate: обязательные поля заполнены.
    private static void Apply(Project project, ProjectRequest r, DateTime now)
    {
        project.Name = r.Name!.Trim();
        project.ObjectType = r.ObjectType!;
        project.Params = r.Params ?? [];
        project.Assumptions = r.Assumptions!;
        project.UpdatedAt = now;
    }
}
