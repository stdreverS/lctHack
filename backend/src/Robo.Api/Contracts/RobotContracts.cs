using System.Text.Json.Serialization;

namespace Robo.Api.Contracts;

// RobotInput из контракта (CLAUDE.md, раздел 5): тело POST и PUT /robots.
// Поля nullable, чтобы пропуски и null проверял RobotsController.Validate с русскими сообщениями.
public class CreateRobotRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }
    [JsonPropertyName("manufacturer")]
    public string? Manufacturer { get; set; }
    [JsonPropertyName("solutionType")]
    public string? SolutionType { get; set; }
    [JsonPropertyName("solutionTypeName")]
    public string? SolutionTypeName { get; set; }
    [JsonPropertyName("objectTypes")]
    public List<string>? ObjectTypes { get; set; }
    [JsonPropertyName("country")]
    public string? Country { get; set; }
    [JsonPropertyName("availability")]
    public string? Availability { get; set; }
    [JsonPropertyName("price")]
    public decimal? Price { get; set; }
    [JsonPropertyName("raasMonthlyPrice")]
    public decimal? RaasMonthlyPrice { get; set; }
    [JsonPropertyName("maintenancePerYear")]
    public decimal? MaintenancePerYear { get; set; }
    [JsonPropertyName("specs")]
    public RobotSpecs? Specs { get; set; }
    [JsonPropertyName("sourceUrl")]
    public string? SourceUrl { get; set; }
    [JsonPropertyName("sourceDate")]
    public DateOnly? SourceDate { get; set; }
    [JsonPropertyName("confirmed")]
    public bool Confirmed { get; set; }
}

// RobotSpecs: все характеристики необязательны, null — «нет данных». Хранится в jsonb.
public class RobotSpecs
{
    [JsonPropertyName("payloadKg")]
    public double? PayloadKg { get; set; }
    [JsonPropertyName("speedMps")]
    public double? SpeedMps { get; set; }
    [JsonPropertyName("perfOpsPerHour")]
    public double? PerfOpsPerHour { get; set; }
    [JsonPropertyName("autonomyH")]
    public double? AutonomyH { get; set; }
    [JsonPropertyName("chargeTimeH")]
    public double? ChargeTimeH { get; set; }
    [JsonPropertyName("positioningMm")]
    public double? PositioningMm { get; set; }
    [JsonPropertyName("navigation")]
    public string? Navigation { get; set; }
    [JsonPropertyName("minAisleM")]
    public double? MinAisleM { get; set; }
    [JsonPropertyName("widthM")]
    public double? WidthM { get; set; }
    [JsonPropertyName("lengthM")]
    public double? LengthM { get; set; }
    [JsonPropertyName("heightM")]
    public double? HeightM { get; set; }
    [JsonPropertyName("lifeYears")]
    public double? LifeYears { get; set; }
}
