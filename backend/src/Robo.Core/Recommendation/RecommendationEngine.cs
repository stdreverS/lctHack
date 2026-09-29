using System.Text.Json;
using Robo.Core.Contracts;
using Robo.Core.Economics;
using Robo.Core.Internal;

namespace Robo.Core.Recommendation;

/// <summary>
/// Подбор rec-1.0 (docs/recommendation.md): кандидаты, проверки ограничений, статус по правилу
/// контракта, балл из пяти факторов, недостающие данные. Перенесено из
/// frontend/src/mocks/data/recommendation.ts без изменений логики.
/// </summary>
internal sealed class RecommendationEngine(EconomicsModel model)
{
    public const string Version = "rec-1.0";

    // Веса и шкалы факторов балла — допущения команды, описаны в docs/recommendation.md, раздел 4
    private const double EconomyWeight = 0.35, PerformanceWeight = 0.25, FitWeight = 0.2, DataQualityWeight = 0.1, AvailabilityWeight = 0.1;
    private const double EconomyPointsPerPaybackYear = 15;
    private const double EconomyUnknown = 40;
    private const double DataConfirmedValue = 100, DataUnconfirmedValue = 40;
    private const double InStockValue = 100, DeliveryTermValue = 75, NoAvailabilityValue = 30;
    private const string InStock = "В наличии";

    private static readonly (string Key, string Label, Func<RobotSpec, object?> Get)[] MissingDataSpecs =
    [
        ("payloadKg", "Грузоподъёмность", r => r.PayloadKg),
        ("perfOpsPerHour", "Производительность", r => r.PerfOpsPerHour),
        ("minAisleM", "Минимальная ширина прохода", r => r.MinAisleM),
        ("autonomyH", "Время автономной работы", r => r.AutonomyH),
        ("chargeTimeH", "Время зарядки", r => r.ChargeTimeH),
        ("lifeYears", "Срок службы", r => r.LifeYears),
    ];

    private static readonly Dictionary<string, int> StatusOrder = new() { ["recommended"] = 0, ["needs_check"] = 1, ["excluded"] = 2 };

    public IReadOnlyList<RecommendationItem> Build(
        IReadOnlyList<RobotSpec> catalog, string objectType, IReadOnlyList<string> processes,
        IReadOnlyDictionary<string, JsonElement> p, ModelInputs inputs)
    {
        var candidates = catalog
            .Where(r => r.ObjectTypes.Contains(objectType) && (r.SolutionType != "cleaner" || processes.Contains("cleaning")))
            .ToList();
        var maxPerf = 1.0;
        foreach (var r in candidates)
            maxPerf = Math.Max(maxPerf, r.SolutionType == "asrs" ? 0 : r.PerfOpsPerHour ?? 0);

        return candidates
            .Select(robot =>
            {
                var checks = Checks(robot, p, inputs);
                var status = StatusOf(checks);
                var breakdown = status == "excluded" ? [] : ScoreFactors(robot, checks, inputs, maxPerf);
                double? score = null;
                if (status != "excluded")
                {
                    var sum = 0.0;
                    foreach (var f in breakdown) sum += f.Contribution;
                    score = Js.Round(sum * 10) / 10;
                }
                var missing = MissingDataSpecs.Where(s => s.Get(robot) == null).Select(s => s.Label).ToList();
                return new RecommendationItem(robot.Id, robot.Name, robot.SolutionType, status, score, checks, breakdown, missing);
            })
            .OrderBy(item => StatusOrder[item.Status])
            .ThenByDescending(item => item.Score ?? 0)
            .ToList();
    }

    private static Check C(string rule, string label, bool critical, string result, string message,
        object? required = null, object? actual = null, string? unit = null) =>
        new(rule, label, critical, result, required, actual, unit, message);

    private List<Check> Checks(RobotSpec robot, IReadOnlyDictionary<string, JsonElement> p, ModelInputs inputs)
    {
        var checks = new List<Check>();
        var isCleaner = robot.SolutionType == "cleaner";
        var fmt = Js.FormatNumber;

        if (EconomicsModel.RequiredPayloadKg(p) is { } payload && !isCleaner)
        {
            checks.Add(robot.PayloadKg is not { } kg
                ? C("payload", "Грузоподъёмность", true, "unknown", "Производитель не указал грузоподъёмность — уточните её перед выбором", payload, null, "кг")
                : kg >= payload
                    ? C("payload", "Грузоподъёмность", true, "pass", $"Грузоподъёмность {fmt(kg)} кг достаточна для единицы {fmt(payload)} кг", payload, kg, "кг")
                    : C("payload", "Грузоподъёмность", true, "fail", $"Грузоподъёмность {fmt(kg)} кг меньше массы единицы {fmt(payload)} кг", payload, kg, "кг"));
        }

        if (EconomicsModel.AvailableAisleM(p) is { } aisle && robot.SolutionType != "asrs")
        {
            checks.Add(robot.MinAisleM is not { } min
                ? C("aisle", "Ширина прохода", true, "unknown", "Нет данных о минимальной ширине прохода — запросите у производителя", null, aisle, "м")
                : min <= aisle
                    ? C("aisle", "Ширина прохода", true, "pass", $"Роботу нужно {fmt(min)} м, на объекте {fmt(aisle)} м", min, aisle, "м")
                    : C("aisle", "Ширина прохода", true, "fail", $"Роботу нужен проход {fmt(min)} м, а на объекте только {fmt(aisle)} м", min, aisle, "м"));
        }

        if (!isCleaner)
        {
            var fleet = EconomicsModel.FleetSize(inputs.TargetPerHour, robot, inputs.Assumptions);
            var target = Js.Round(inputs.TargetPerHour);
            var maxFleet = model.Norms.MaxFleet;
            checks.Add(fleet is not { } n
                ? C("performance", "Производительность", true, "unknown", "Производительность не указана — число роботов нельзя оценить", target, null, "опер./ч")
                : n <= maxFleet
                    ? C("performance", "Производительность", true, "pass", $"Целевые {fmt(target)} опер./ч обеспечат {n} роб.", target, robot.PerfOpsPerHour, "опер./ч")
                    : C("performance", "Производительность", true, "fail", $"Потребуется {n} роботов — больше разумного размера парка ({Js.Plain(maxFleet)})", target, robot.PerfOpsPerHour, "опер./ч"));
        }

        var shift = inputs.Assumptions.HoursPerShift;
        checks.Add(robot.AutonomyH is not { } autonomy
            ? C("autonomy", "Автономность", false, "unknown", "Время автономной работы не указано", shift, null, "ч")
            : autonomy >= shift
                ? C("autonomy", "Автономность", false, "pass", $"Заряда хватает на смену ({fmt(autonomy)} ч)", shift, autonomy, "ч")
                : C("autonomy", "Автономность", false, "fail", $"Заряда хватает на {fmt(autonomy)} ч — понадобится подзарядка в смену", shift, autonomy, "ч"));

        checks.Add(robot.Confirmed
            ? C("dataConfirmed", "Достоверность данных", false, "pass", "Характеристики подтверждены источником")
            : C("dataConfirmed", "Достоверность данных", false, "unknown", "Характеристики не подтверждены — используйте оценку с осторожностью"));
        return checks;
    }

    /// <summary>Правило контракта: критичная fail → excluded; иначе критичная unknown → needs_check.</summary>
    private static string StatusOf(List<Check> checks) =>
        checks.Any(c => c.Critical && c.Result == "fail") ? "excluded"
        : checks.Any(c => c.Critical && c.Result == "unknown") ? "needs_check"
        : "recommended";

    private static double Clamp(double v) => Math.Max(0, Math.Min(100, Js.Round(v)));

    private List<ScoreFactor> ScoreFactors(RobotSpec robot, List<Check> checks, ModelInputs inputs, double maxPerf)
    {
        var a = inputs.Assumptions;
        var economy = EconomyUnknown;
        if (EconomicsModel.FleetSize(inputs.TargetPerHour, robot, a) is { } fleet)
        {
            var e = EconomicsModel.Calculate(inputs, fleet,
                model.PurchaseCapex(fleet, (double)robot.Price), model.PurchaseRobotOpex(fleet, robot, a));
            economy = e.PaybackYears is { } payback ? Clamp(100 - payback * EconomyPointsPerPaybackYear) : 0;
        }
        var perf = robot.PerfOpsPerHour;
        var passed = checks.Count(c => c.Result == "pass");
        var availability = robot.Availability == InStock ? InStockValue
            : !string.IsNullOrEmpty(robot.Availability) ? DeliveryTermValue
            : NoAvailabilityValue;

        (string Factor, string Label, double Weight, double Value)[] raw =
        [
            ("economy", "Экономика (окупаемость)", EconomyWeight, economy),
            ("performance", "Производительность", PerformanceWeight, perf is { } pf && pf != 0 ? Clamp(pf / maxPerf * 100) : 0),
            ("fit", "Соответствие объекту", FitWeight, Clamp((double)passed / checks.Count * 100)),
            ("dataQuality", "Полнота и достоверность данных", DataQualityWeight, robot.Confirmed ? DataConfirmedValue : DataUnconfirmedValue),
            ("availability", "Доступность поставки", AvailabilityWeight, availability),
        ];
        return raw.Select(f => new ScoreFactor(f.Factor, f.Label, f.Weight, f.Value, Js.Round(f.Weight * f.Value * 10) / 10)).ToList();
    }
}
