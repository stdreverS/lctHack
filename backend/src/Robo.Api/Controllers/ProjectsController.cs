using Robo.Api.Data;
using Robo.Api.Data.Entities;
using Robo.Api.Contracts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Npgsql.Internal.Postgres;

namespace Robo.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/projects")]
public class ProjectsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ProjectsController(AppDbContext db)
    {
        _db = db;
    }

    private string GetUserId()
    {
        return User.FindFirst("userId")?.Value ?? "";
    }

    [HttpGet]
    public async Task<IActionResult> GetAllProjects()
    {
        var userId = GetUserId();
        var projects = await _db.Projects.Where(p => p.UserId == userId).ToListAsync();
        return Ok(projects);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProject([FromBody] ProjectRequest request)
    {
        var userId = Guid.NewGuid().ToString();
        var project = new Project
        {
            Id = userId,
            Name = request.Name,
            ObjectType = request.ObjectType,
            Params = request.Params,
            CreatedAt = DateTime.UtcNow.ToString(),
            UpdatedAt = DateTime.UtcNow.ToString()
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        return StatusCode(201, project);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProject(string id)
    {
        var userId = GetUserId();
        var project = await _db.Projects.FirstOrDefaultAsync(r => r.Id == id && r.Id == userId);
        if (project == null)
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Проект не найден - возможно, он был удален",
                Errors = new()
            });
        return Ok(project);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(string id)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(r => r.Id == id);
        if (project == null)
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Проект не найден - возможно, он был удален",
                Errors = new()
            });
        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/copy")]
    public async Task<IActionResult> CreateCopyProject(string id)
    {
        var userId = GetUserId();
        var project = await _db.Projects.FirstOrDefaultAsync(r => r.Id == id && r.Id == userId);
        if (project == null)
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Проект не найден - возможно, он был удален",
                Errors = new()
            });
        var projectCopy = new Project
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Name = project.Name + "(Копия)",
            ObjectType = project.ObjectType,
            Params = project.Params,
            Assumptions = project.Assumptions,
            CreatedAt = DateTime.UtcNow.ToString(),
            UpdatedAt = DateTime.UtcNow.ToString()
        };
        _db.Projects.Add(projectCopy);
        await _db.SaveChangesAsync();
        return StatusCode(201, project);
    }
}