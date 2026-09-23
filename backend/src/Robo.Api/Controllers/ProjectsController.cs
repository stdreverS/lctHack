using Robo.Api.Data;
using Robo.Api.Data.Entities;
using Robo.Api.Contracts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Robo.Api.Controllers;

[ApiController]
[Route("/api/v1/projects")]
public class ProjectsController : ControllerBase
{
    private readonly AppDbContext _db;
    private string _nextIndex = string.Empty;
    ProjectsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllProjects()
    {
        var projects = await _db.Projects.ToListAsync();
        return Ok(projects);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProject([FromBody] ProjectRequest request)
    {
        var project = new Project
        {
            Id = _nextIndex,
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
        var project = await _db.Projects.FirstOrDefaultAsync(r => r.Id == id);
        if (project == null)
            return NotFound(new { status = 404, code = "NOT_FOUND", title = "Проект не найден - возможно, он был удален" });
        return Ok(project);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(string id)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(r => r.Id == id);
        if (project == null)
            return NotFound(new { status = 404, code = "NOT_FOUND", title = "Проект не найден - возможно, он был удален" });
        _db.Projects.Remove(project);
        return NoContent();
    }

    [HttpPost("{id}/copy")]
    public async Task<IActionResult> CreateCopyProject(string id)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(r => r.Id == id);
        if (project == null)
            return NotFound(new { status = 404, code = "NOT_FOUND", title = "Проект не найден - возможно, он был удален" });
        var projectCopy = project;
        projectCopy.Name += "(Копия)";
        projectCopy.CreatedAt = DateTime.UtcNow.ToString();
        projectCopy.UpdatedAt = DateTime.UtcNow.ToString();
        await _db.SaveChangesAsync();
        return StatusCode(201, project);
    }
}