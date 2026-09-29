using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Robo.Api.Auth;
using Robo.Api.Contracts;
using Robo.Api.Data;
using Robo.Api.Data.Entities;
using Robo.Api.Errors;
using Robo.Api.Mapping;
using Robo.Api.Reports;
using Robo.Core;
using Robo.Core.Contracts;

namespace Robo.Api.Controllers;

[ApiController]
[Route("api/v1/calculations")]
public class CalculationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EngineConfig _config;

    public CalculationsController(AppDbContext db, EngineConfig config)
    {
        _db = db;
        _config = config;
    }

    /// <summary>
    /// Расчёт. Гость (нет токена или projectId: null) — только ответ, без сохранения.
    /// Токен и projectId своего проекта — новая запись истории со снимком запроса и версиями;
    /// прежние записи не меняются.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Calculate([FromBody] CalcRequest request)
    {
        if (_config.ObjectTypes.All(t => t.Code != request.ObjectType))
            return ApiResults.Invalid([new ErrorDetail { Field = "objectType", Message = "Выберите тип объекта из списка" }]);

        // Порядок каталога — как в демо-каталоге: при равном балле роботы идут в этом порядке
        var robots = (await _db.Robots.AsNoTracking().OrderBy(r => r.Id).ToListAsync()).Select(r => r.ToSpec()).ToList();

        var scenarioErrors = new List<ErrorDetail>();
        for (var i = 0; i < request.Scenarios.Count; i++)
        {
            var s = request.Scenarios[i];
            if (s.Kind != "baseline" && robots.All(r => r.Id != s.RobotId))
                scenarioErrors.Add(new ErrorDetail { Field = $"scenarios[{i}].robotId", Message = $"Выберите робота для сценария «{s.Title}»" });
        }
        if (scenarioErrors.Count > 0) return ApiResults.Invalid(scenarioErrors);

        Project? project = null;
        var isUser = User.Identity?.IsAuthenticated == true;
        if (isUser && !string.IsNullOrEmpty(request.ProjectId))
        {
            var userId = User.UserId();
            project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.UserId == userId);
            if (project == null) return ApiResults.NotFound("Проект");
        }

        CalcResult result;
        try
        {
            result = CalculationEngine.Calculate(request, robots, _config);
        }
        catch (CalculationException e)
        {
            // Нет производительности или цены аренды, и они не заданы вручную
            return ApiResults.Error(422, "CALCULATION_ERROR", e.Message);
        }
        if (project == null) return Ok(result);   // гость: calculationId = null, ничего не пишем

        var record = new CalculationResult
        {
            Id = Guid.NewGuid().ToString(),
            ProjectId = project.Id,
            Inputs = request,
            ModelVersion = result.ModelVersion,
            DataVersion = result.DataVersion,
            BestPaybackYears = result.BestPaybackYears(),
            CreatedAt = ApiTime.Now()
        };
        record.Results = result with { CalculationId = record.Id };
        _db.CalculationResults.Add(record);
        project.UpdatedAt = record.CreatedAt;
        await _db.SaveChangesAsync();

        return Ok(record.Results);
    }

    /// <summary>История расчётов проекта, новые сверху.</summary>
    [Authorize]
    [HttpGet("/api/v1/projects/{projectId}/calculations")]
    public async Task<IActionResult> GetProjectCalculations(string projectId)
    {
        var userId = User.UserId();
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId && p.UserId == userId))
            return ApiResults.NotFound("Проект");

        var list = await _db.CalculationResults.AsNoTracking()
            .Where(c => c.ProjectId == projectId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new CalculationSummary(c.Id, c.CreatedAt, c.ModelVersion, c.DataVersion, c.BestPaybackYears))
            .ToListAsync();
        return Ok(list);
    }

    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetCalculationRecord(string id)
    {
        var calc = await FindOwnAsync(id);
        return calc == null
            ? ApiResults.NotFound("Расчёт")
            : Ok(new CalculationRecord(calc.Id, calc.CreatedAt, calc.Inputs, calc.Results));
    }

    /// <summary>
    /// Серверного PDF нет: честный 501 вместо файла-пустышки. Отчёт для печати и PDF фронтенд
    /// формирует сам (шаг «Экспорт» → «Отчёт для печати и PDF»).
    /// </summary>
    [Authorize]
    [HttpGet("{id}/report.pdf")]
    public async Task<IActionResult> DownloadPdf(string id)
    {
        if (await FindOwnAsync(id) == null) return ApiResults.NotFound("Расчёт");
        return ApiResults.Error(501, "SERVER_ERROR",
            "PDF на сервере пока не формируется. На шаге «Экспорт» откройте «Отчёт для печати и PDF» и сохраните его как PDF");
    }

    [Authorize]
    [HttpGet("{id}/export.xlsx")]
    public async Task<IActionResult> DownloadExcel(string id)
    {
        var calc = await FindOwnAsync(id);
        if (calc == null) return ApiResults.NotFound("Расчёт");

        var bytes = ExcelReport.Build(calc, _config);
        return File(bytes, ExcelReport.ContentType, $"export-{id}.xlsx");
    }

    private Task<CalculationResult?> FindOwnAsync(string id)
    {
        var userId = User.UserId();
        return _db.CalculationResults.AsNoTracking().FirstOrDefaultAsync(c =>
            c.Id == id && _db.Projects.Any(p => p.Id == c.ProjectId && p.UserId == userId));
    }
}
