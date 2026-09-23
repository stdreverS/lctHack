using Microsoft.AspNetCore.Mvc;
using Robo.Api.Contracts;
using System.Collections.Generic;

namespace Robo.Api.Controllers;

[ApiController]
[Route("/api/v1/robots")]
public class RobotsController : ControllerBase
{

    private static readonly List<RobotResponse> _mocDb = new();
    private static string _nextId = "";

    [HttpGet]
    public IActionResult GetAllRobots()
    {
        return Ok(_mocDb);
    }

    [HttpPost]
    public IActionResult CreateRobot([FromBody] CreateRobotRequest request)
    {
        RobotResponse response = new RobotResponse
        {
            Id = _nextId,
            Name = request.Name,
            Manufactures = request.Manufactures,
            SolutionType = request.SolutionType,
            SolutionTypeName = request.SolutionTypeName,
            ObjectTypes = request.ObjectTypes,
            Country = request.Country,
            Availability = request.Availability,
            Price = request.Price,
            RaasMothlyPrice = request.RaasMothlyPrice,
            MaintenancePerYear = request.MaintenancePerYear,
            Specs = request.Specs,
            SourceUrl = request.SourceUrl,
            SourceDate = request.SourceDate,
            Confirmed = request.Confirmed
        };
        return StatusCode(201, response);
    }

    [HttpGet("{id}")]
    public IActionResult GetRobot(string id)
    {
        var robot = _mocDb.FirstOrDefault(r => r.Id == id);
        if (robot == null)
            return NotFound(new { Error = $"Робот с id {id} не найден" });
        return Ok(robot);
    }

    [HttpPut("{id}")]
    public IActionResult UpdateRobot(string id)
    {
        // TODO: query to data base
        return Ok();
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteRobot(string id)
    {
        // TODO: query to data base
        return StatusCode(204, new { });
    }
}