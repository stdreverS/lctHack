using System.Text.Json.Serialization;

namespace Robo.Core.Contracts;

// Зеркало типов ответа POST /calculations (CLAUDE.md, раздел 5).
// Необязательные поля контракта (field?: T) помечены WhenWritingNull — в JSON их нет, если null.

public sealed record Check(
    string Rule,
    string Label,
    bool Critical,
    string Result,               // pass | fail | unknown
    object? Required,            // число, строка или null
    object? Actual,
    string? Unit,
    string Message);

public sealed record ScoreFactor(string Factor, string Label, double Weight, double Value, double Contribution);

public sealed record RecommendationItem(
    string RobotId,
    string Name,
    string SolutionType,
    string Status,               // recommended | excluded | needs_check
    double? Score,
    IReadOnlyList<Check> Checks,
    IReadOnlyList<ScoreFactor> ScoreBreakdown,
    IReadOnlyList<string> MissingData);

public sealed record MetricBreakdownItem(
    string Key,
    string Label,
    decimal Value,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Source = null);

public sealed record Metric(
    string Label,
    decimal? Value,
    string Unit,
    string Formula,              // человекочитаемая формула
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<MetricBreakdownItem>? Breakdown,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyDictionary<string, double>? Inputs,
    bool Overridden);

/// <summary>Record&lt;MetricKey, Metric&gt;: все восемь ключей обязательны.</summary>
public sealed record ScenarioMetrics(
    Metric RobotCount,
    Metric CapexRub,
    Metric OpexAnnualRub,
    Metric OpexDeltaRub,
    Metric AnnualEffectRub,
    Metric PaybackYears,
    Metric RoiPercent,
    Metric TcoRub);

public sealed record EquipmentLine(string Item, int Qty, decimal UnitPriceRub, decimal TotalRub);

public sealed record CashflowYear(int Year, decimal CapexRub, decimal OpexRub, decimal EffectRub, decimal CumulativeRub);

public sealed record Verdict(
    string Level,                // good | moderate | poor | negative
    string Label,
    string Interpretation,
    IReadOnlyList<string> Risks);

public sealed record ScenarioResult(
    string Id,
    string Kind,                 // baseline | purchase | raas
    string Title,
    string? RobotId,
    IReadOnlyList<EquipmentLine> Equipment,
    ScenarioMetrics Metrics,
    IReadOnlyList<CashflowYear> Cashflow,
    Verdict Verdict);

public sealed record SensitivityPoint(double Delta, decimal? PaybackYears, decimal? RoiPercent, decimal AnnualEffectRub);

public sealed record SensitivitySeries(
    string ScenarioId,
    string Param,                // equipmentPrice | operationsVolume | laborCost
    string Label,
    IReadOnlyList<SensitivityPoint> Points);

public sealed record AssumptionRef(
    string Key,
    string Label,
    object Value,                // число или строка
    string Unit,
    string Source,
    bool Confirmed);

public sealed record CalcResult(
    string? CalculationId,       // null для гостя; для сохранённого расчёта id подставляет API
    string ModelVersion,
    string DataVersion,
    DateTime CalculatedAt,       // UTC
    string Disclaimer,
    IReadOnlyList<RecommendationItem> Recommendation,
    IReadOnlyList<ScenarioResult> Scenarios,
    IReadOnlyList<SensitivitySeries> Sensitivity,
    IReadOnlyList<AssumptionRef> AssumptionsUsed);
