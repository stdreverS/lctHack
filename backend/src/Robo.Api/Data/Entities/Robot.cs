using Robo.Api.Contracts;
namespace Robo.Api.Data.Entities;


public class Robot
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Manufacturer { get; set; } = string.Empty;

    public string SolutionType { get; set; } = string.Empty;

    public List<string> ObjectTypes { get; set; } = new();
    public decimal Price { get; set; }
    public decimal RaasMothlyPrice { get; set; }
    public decimal MaintenancePerYear { get; set; }
    public RobotSpecs Specs { get; set; } = new();
    public string SourceUrl { get; set; } = string.Empty;
    public string SourceDate { get; set; } = string.Empty;
    public bool Confirmed { get; set; } = false;
}