using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Robo.Api.Contracts;

public class CreateRobotRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    [JsonPropertyName("manufactures")]
    public string Manufactures { get; set; } = string.Empty;
    [JsonPropertyName("solutionType")]
    public string SolutionType { get; set; } = string.Empty;
    [JsonPropertyName("solutionTypeName")]
    public string SolutionTypeName { get; set; } = string.Empty;
    [JsonPropertyName("objectTypes")]
    public List<string> ObjectTypes { get; set; } = new();
    [JsonPropertyName("country")]
    public string Country { get; set; } = string.Empty;
    [JsonPropertyName("availability")]
    public string Availability { get; set; } = string.Empty;
    [JsonPropertyName("price")]
    public decimal Price { get; set; }
    [JsonPropertyName("raasMonthlyPrice")]
    public decimal RaasMothlyPrice { get; set; }
    [JsonPropertyName("maintenancePerYear")]
    public decimal MaintenancePerYear { get; set; }
    [JsonPropertyName("specs")]
    public RobotSpecs Specs { get; set; } = new();
    [JsonPropertyName("sourceUrl")]
    public string SourceUrl { get; set; } = string.Empty;
    [JsonPropertyName("sourceDate")]
    public string SourceDate { get; set; } = string.Empty;
    [JsonPropertyName("confirmed")]
    public bool Confirmed = false;

}

public class RobotSpecs
{
    [JsonPropertyName("payloadKg")]
    public int PayloadKg { get; set; }
    [JsonPropertyName("speedMps")]
    public double SpeedMps { get; set; }
    [JsonPropertyName("perfOpsPerHouse")]
    public int PerfOpsPerHouse { get; set; }
    [JsonPropertyName("autonomyH")]
    public int AutonomyH { get; set; }
    [JsonPropertyName("chargeTimeH")]
    public float ChargeTimeH { get; set; }
    [JsonPropertyName("positioningMm")]
    public int PositioningMm { get; set; }
    [JsonPropertyName("navigation")]
    public string Navigation { get; set; } = string.Empty;
    [JsonPropertyName("minAislemM")]
    public float MinAislemM { get; set; }
    [JsonPropertyName("widthM")]
    public int WidthM { get; set; }
    [JsonPropertyName("lengthM")]
    public float LengthM { get; set; }
    [JsonPropertyName("heigthM")]
    public float HeigthM { get; set; }
    [JsonPropertyName("lifeYears")]
    public int LifeYears { get; set; }
}


public class RobotResponse
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    [JsonPropertyName("manufactures")]
    public string Manufactures { get; set; } = string.Empty;
    [JsonPropertyName("solutionType")]
    public string SolutionType { get; set; } = string.Empty;
    [JsonPropertyName("solutionTypeName")]
    public string SolutionTypeName { get; set; } = string.Empty;
    [JsonPropertyName("objectTypes")]
    public List<string> ObjectTypes { get; set; } = new();
    [JsonPropertyName("country")]
    public string Country { get; set; } = string.Empty;
    [JsonPropertyName("availability")]
    public string Availability { get; set; } = string.Empty;
    [JsonPropertyName("price")]
    public decimal Price { get; set; }
    [JsonPropertyName("raasMonthlyPrice")]
    public decimal RaasMothlyPrice { get; set; }
    [JsonPropertyName("maintenancePerYear")]
    public decimal MaintenancePerYear { get; set; }
    [JsonPropertyName("specs")]
    public RobotSpecs Specs { get; set; } = new();
    [JsonPropertyName("sourceUrl")]
    public string SourceUrl { get; set; } = string.Empty;
    [JsonPropertyName("sourceDate")]
    public string SourceDate { get; set; } = string.Empty;
    [JsonPropertyName("confirmed")]
    public bool Confirmed = false;

}