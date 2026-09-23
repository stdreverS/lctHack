using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace Robo.Api.Contracts;

public class ProjectRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    [JsonPropertyName("objectType")]
    public List<string> ObjectType { get; set; } = new();
    [JsonPropertyName("params")]
    public ProjectParams Params { get; set; } = new();
    [JsonPropertyName("assumptions")]
    public ProjectAssumptions Assumptions { get; set; } = new();
}

public class ProjectParams
{
    [JsonPropertyName("areaM2")]
    public int AreaM2 { get; set; }
    [JsonPropertyName("workMode")]
    public string WorkMode { get; set; } = string.Empty;
    [JsonPropertyName("inboundPerDay")]
    public int InboundPerDay { get; set; }
    [JsonPropertyName("internalPerDay")]
    public int InternalPerDay { get; set; }
    [JsonPropertyName("outboundPerDay")]
    public int OutboundPerDay { get; set; }
    [JsonPropertyName("processPerfPerHour")]
    public int ProcessPerfPerHour { get; set; }
    [JsonPropertyName("storageType")]
    public string StorageType { get; set; } = string.Empty;
    [JsonPropertyName("skuCount")]
    public int SkuCount { get; set; }
    [JsonPropertyName("unitWeightKg")]
    public int UnitWeightKg { get; set; }
    [JsonPropertyName("unitLengthM")]
    public float UnitLengthM { get; set; }
    [JsonPropertyName("unitWidthM")]
    public float UnitWidthM { get; set; }
    [JsonPropertyName("unitHeightM")]
    public float UnitHeightM { get; set; }
    [JsonPropertyName("staffCount")]
    public int StaffCount { get; set; }
    [JsonPropertyName("staffCostMonthRub")]
    public int StaffCostMonthRub { get; set; }
    [JsonPropertyName("avgRouteM")]
    public int AvgRouteM { get; set; }
    [JsonPropertyName("aisleWidthM")]
    public int AisleWidthM { get; set; }
}


public class ProjectAssumptions
{
    [JsonPropertyName("horizonYears")]
    public int HorizonYears { get; set; }
    [JsonPropertyName("workDayPerYear")]
    public int WorkDayPerYear { get; set; }
    [JsonPropertyName("shiftsPerDay")]
    public int ShiftsPerDay { get; set; }
    [JsonPropertyName("hoursPerShift")]
    public int HoursPerShift { get; set; }
    [JsonPropertyName("utilization")]
    public float Utilization { get; set; }
    [JsonPropertyName("availability")]
    public float Availability { get; set; }
    [JsonPropertyName("reserveShare")]
    public float ReserveShare { get; set; }
    [JsonPropertyName("staffReplacedShare")]
    public float StaffReplacedShare { get; set; }
}

public class ProjectResponse
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> ObjectType { get; set; } = new();
    public ProjectParams Params { get; set; } = new();
    public ProjectAssumptions Assumptions { get; set; } = new();
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}