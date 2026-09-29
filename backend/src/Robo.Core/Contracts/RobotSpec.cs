namespace Robo.Core.Contracts;

/// <summary>
/// Робот глазами расчётного ядра: плоская модель без зависимости от EF.
/// API заполняет её из своей сущности Robot (характеристики из specs — на верхнем уровне).
/// </summary>
public sealed record RobotSpec
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string SolutionType { get; init; }
    public IReadOnlyList<string> ObjectTypes { get; init; } = [];
    public string? Availability { get; init; }
    public bool Confirmed { get; init; }

    public decimal Price { get; init; }
    public decimal? RaasMonthlyPrice { get; init; }
    public decimal MaintenancePerYear { get; init; }

    public double? PayloadKg { get; init; }
    public double? SpeedMps { get; init; }
    public double? PerfOpsPerHour { get; init; }
    public double? AutonomyH { get; init; }
    public double? ChargeTimeH { get; init; }
    public double? PositioningMm { get; init; }
    public string? Navigation { get; init; }
    public double? MinAisleM { get; init; }
    public double? WidthM { get; init; }
    public double? LengthM { get; init; }
    public double? HeightM { get; init; }
    public double? LifeYears { get; init; }
}
