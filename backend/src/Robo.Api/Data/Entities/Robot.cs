using Robo.Api.Contracts;

namespace Robo.Api.Data.Entities;

// Совпадает с Robot из контракта (CLAUDE.md, раздел 5): сущность отдаётся в ответах как есть.
public class Robot
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Manufacturer { get; set; } = string.Empty;
    public string SolutionType { get; set; } = string.Empty;
    public string SolutionTypeName { get; set; } = string.Empty;
    public List<string> ObjectTypes { get; set; } = new();
    public string? Country { get; set; }
    public string? Availability { get; set; }
    public decimal Price { get; set; }
    public decimal? RaasMonthlyPrice { get; set; }
    public decimal MaintenancePerYear { get; set; }
    public RobotSpecs Specs { get; set; } = new();               // jsonb
    public string? SourceUrl { get; set; }
    public DateOnly? SourceDate { get; set; }
    public bool Confirmed { get; set; }
}
