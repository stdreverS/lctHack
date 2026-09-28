using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Robo.Api.Contracts;
using Robo.Api.Data;
using Robo.Api.Data.Entities;

namespace Robo.Api.Controllers;

[ApiController]
[Route("/api/v1/robots")]
public class RobotsController : ControllerBase
{

    private readonly AppDbContext _db;

    RobotsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllRobots()
    {
        var robots = await _db.Robots.ToListAsync();
        return Ok(robots);
    }


    [HttpGet("{id}")]
    public async Task<IActionResult> GetRobot(string id)
    {
        var robot = await _db.Robots.FirstOrDefaultAsync(r => r.Id == id);
        if (robot == null)
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Робот не найден - возможно, он был удален",
                Errors = new()
            });
        return Ok(robot);
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> CreateRobot([FromBody] CreateRobotRequest request)
    {
        var robot = new Robot
        {
            Id = Guid.NewGuid().ToString(),
            Name = request.Name,
            Manufacturer = request.Manufacturer,
            SolutionType = request.SolutionType,
            ObjectTypes = request.ObjectTypes,
            Price = request.Price,
            RaasMothlyPrice = request.RaasMothlyPrice,
            MaintenancePerYear = request.MaintenancePerYear,
            Specs = request.Specs,
            SourceUrl = request.SourceUrl,
            SourceDate = request.SourceDate,
            Confirmed = request.Confirmed
        };
        _db.Robots.Add(robot);
        await _db.SaveChangesAsync();
        return StatusCode(201, robot);
    }


    [Authorize(Roles = "admin")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRobot(string id, [FromBody] CreateRobotRequest request)
    {
        var robot = await _db.Robots.FirstOrDefaultAsync(r => r.Id == id);
        if (robot == null)
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Робот не найден - возможно, он был удален",
                Errors = new()
            });
        robot.Name = request.Name;
        robot.Manufacturer = request.Manufacturer;
        robot.SolutionType = request.SolutionType;
        robot.ObjectTypes = request.ObjectTypes;
        robot.Price = request.Price;
        robot.RaasMothlyPrice = request.RaasMothlyPrice;
        robot.MaintenancePerYear = request.MaintenancePerYear;
        robot.Specs = request.Specs;
        robot.SourceUrl = request.SourceUrl;
        robot.SourceDate = request.SourceDate;
        robot.Confirmed = request.Confirmed;

        await _db.SaveChangesAsync();
        return Ok();
    }

    [Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRobot(string id)
    {
        var robot = await _db.Robots.FirstOrDefaultAsync(r => r.Id == id);
        if (robot == null)
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Code = "NOT_FOUND",
                Title = "Робот не найден - возможно, он был удален",
                Errors = new()
            });

        _db.Robots.Remove(robot);
        return NoContent();
    }
}