using System.Text.Json;
using System.Text.Json.Serialization;

namespace Robo.Core.Contracts;

// Зеркало типов запроса POST /calculations (CLAUDE.md, раздел 5).
// Перечисления контракта — строки; допустимые значения перечислены в комментариях.

/// <summary>Допущения расчёта. Доли — от 0 до 1.</summary>
public sealed record Assumptions(
    int HorizonYears,
    int WorkDaysPerYear,
    int ShiftsPerDay,
    double HoursPerShift,
    double Utilization,
    double Availability,
    double ReserveShare,
    double StaffReplacedShare);

/// <summary>Ручные правки what-if; null — значение считает сервер.</summary>
public sealed record ScenarioOverrides(
    int? RobotCount = null,
    decimal? UnitPriceRub = null,
    double? PerfOpsPerHour = null,
    decimal? MaintenancePerYearRub = null);

public sealed record RaasTerms(decimal MonthlyFeePerRobotRub, int ContractYears, decimal SetupRub);

public sealed record ScenarioInput(
    string Id,
    string Kind,                 // baseline | purchase | raas
    string Title,
    string? RobotId,             // null только для baseline
    ScenarioOverrides? Overrides = null,
    RaasTerms? Raas = null);

public sealed record SensitivityRequest(
    IReadOnlyList<string> Params,   // equipmentPrice | operationsVolume | laborCost
    IReadOnlyList<double> Deltas);

public sealed record SimKpi(
    string EngineVersion,
    long Seed,
    double ThroughputPerHour,
    double TargetPerHour,
    double AchievedPercent,
    double AvgUtilization,
    double IdleShare,
    double ChargingShare,
    int MaxQueue,
    string Bottleneck,
    bool ConfirmsCalculation);

public sealed record CalcRequest(
    string? ProjectId,
    string ObjectType,
    IReadOnlyList<string> Processes,
    // Параметры объекта: число, строка, bool или null (ParamValue)
    IReadOnlyDictionary<string, JsonElement> Params,
    Assumptions Assumptions,
    IReadOnlyList<ScenarioInput> Scenarios,
    SensitivityRequest Sensitivity,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] SimKpi? Simulation = null);
