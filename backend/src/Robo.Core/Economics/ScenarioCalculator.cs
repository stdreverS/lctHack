using Robo.Core.Contracts;
using Robo.Core.Internal;

namespace Robo.Core.Economics;

/// <summary>
/// Сценарии, вывод, денежный поток, показатели с формулами и чувствительность (econ-1.0).
/// Перенесено из frontend/src/mocks/data/calculation.ts без изменений логики.
/// </summary>
internal sealed class ScenarioCalculator(EconomicsModel model)
{
    /// <summary>Множители анализа чувствительности.</summary>
    private sealed record Factors(double Price, double Volume, double Labor)
    {
        public static readonly Factors None = new(1, 1, 1);
    }

    private sealed record Computed(
        EconomicsValues Econ, IReadOnlyList<EquipmentLine> Equipment,
        bool CountOverridden, bool PriceOverridden, bool OpexOverridden);

    private static readonly IReadOnlyDictionary<string, string> SensLabels = new Dictionary<string, string>
    {
        ["equipmentPrice"] = "Стоимость оборудования",
        ["operationsVolume"] = "Объём операций",
        ["laborCost"] = "Стоимость труда",
    };

    private ModelNorms Norms => model.Norms;

    public ScenarioResult Scenario(ScenarioInput s, RobotSpec? robot, ModelInputs inputs)
    {
        var c = Compute(s, robot, inputs, Factors.None);
        var horizon = inputs.Assumptions.HorizonYears;
        return new ScenarioResult(s.Id, s.Kind, s.Title, s.RobotId,
            c.Equipment, Metrics(c, inputs), Cashflow(c.Econ, horizon), Verdict(s, c.Econ, robot, horizon));
    }

    /// <summary>Ряды чувствительности: для каждого сценария покупки и аренды × каждый параметр.</summary>
    public IEnumerable<SensitivitySeries> Sensitivity(ScenarioInput s, RobotSpec? robot, ModelInputs inputs, SensitivityRequest request) =>
        request.Params.Select(param => new SensitivitySeries(
            s.Id, param, SensLabels.GetValueOrDefault(param, param),
            request.Deltas.Select(delta =>
            {
                var e = Compute(s, robot, inputs, FactorsFor(param, delta)).Econ;
                return new SensitivityPoint(delta, Js.Dec(e.PaybackYears), Js.Dec(e.RoiPercent), Js.Dec(e.AnnualEffectRub));
            }).ToList()));

    private static Factors FactorsFor(string param, double delta) => param switch
    {
        "equipmentPrice" => Factors.None with { Price = 1 + delta },
        "operationsVolume" => Factors.None with { Volume = 1 + delta },
        _ => Factors.None with { Labor = 1 + delta },
    };

    private static ModelInputs Scaled(ModelInputs inputs, Factors f) => inputs with
    {
        TargetPerHour = inputs.TargetPerHour * f.Volume,
        StaffCount = inputs.StaffCount * f.Volume,
        StaffCostMonthRub = inputs.StaffCostMonthRub * f.Labor,
    };

    private static EquipmentLine Line(string item, int qty, double unitPriceRub) =>
        new(item, qty, Js.Dec(unitPriceRub), Js.Dec(qty * unitPriceRub));

    private Computed Compute(ScenarioInput s, RobotSpec? robot, ModelInputs baseInputs, Factors f)
    {
        var inputs = Scaled(baseInputs, f);
        var a = inputs.Assumptions;
        if (s.Kind == "baseline" || robot == null)
            return new Computed(EconomicsModel.Calculate(inputs, 0, 0, 0), [], false, false, false);

        var manualCount = s.Overrides?.RobotCount;
        var manualPerf = s.Overrides?.PerfOpsPerHour;
        var manualMaintenance = (double?)s.Overrides?.MaintenancePerYearRub;
        var needed = EconomicsModel.FleetSize(inputs.TargetPerHour, robot, a, manualPerf);
        var count = manualCount ?? needed
            ?? throw new CalculationException($"Для «{robot.Name}» не указана производительность — задайте её или число роботов вручную");
        var coverage = needed is { } n ? (double)count / n : 1;
        var countOverridden = manualCount != null || manualPerf != null;

        if (s.Kind == "purchase")
        {
            var manualPrice = (double?)s.Overrides?.UnitPriceRub;
            var unitPrice = Js.Round((manualPrice ?? (double)robot.Price) * f.Price);
            EquipmentLine[] equipment =
            [
                Line(robot.Name, count, unitPrice),
                Line("Зарядная станция", model.Chargers(count), Norms.ChargerPriceRub),
                Line("ПО управления парком и интеграция с WMS", 1, Norms.IntegrationRub),
                Line("Пусконаладка и обучение персонала", 1, Norms.CommissioningRub),
            ];
            var capex = 0.0;
            foreach (var line in equipment) capex += (double)line.TotalRub;
            return new Computed(
                EconomicsModel.Calculate(inputs, count, capex, model.PurchaseRobotOpex(count, robot, a, manualMaintenance), coverage),
                equipment, countOverridden, manualPrice != null, manualMaintenance != null);
        }

        var fee = (double?)s.Raas?.MonthlyFeePerRobotRub ?? (double?)robot.RaasMonthlyPrice
            ?? throw new CalculationException($"У «{robot.Name}» нет цены аренды (RaaS) — укажите ежемесячную плату за робота");
        var setup = (double?)s.Raas?.SetupRub ?? Norms.RaasSetupRub;
        return new Computed(
            EconomicsModel.Calculate(inputs, count, setup, model.RaasRobotOpex(count, Js.Round(fee * f.Price), a), coverage),
            [Line("Внедрение, интеграция и подготовка площадки (RaaS)", 1, setup)],
            countOverridden, false, false);
    }

    /// <summary>Вывод о целесообразности (п. 3.5.7): уровень по порогам окупаемости из norms.json и риски.</summary>
    private Verdict Verdict(ScenarioInput s, EconomicsValues e, RobotSpec? robot, int horizon)
    {
        if (s.Kind == "baseline")
            return new Verdict("moderate", "Текущее состояние",
                "Процессы выполняет персонал, инвестиций нет. Сценарий — точка отсчёта для сравнения.",
                ["Рост фонда оплаты труда", "Нехватка персонала в пиковые периоды"]);

        var risks = new List<string>();
        if (robot is { Confirmed: false }) risks.Add("Характеристики робота не подтверждены источником");
        if (s.Kind == "raas" && s.Raas != null && s.Raas.ContractYears < horizon)
            risks.Add("Срок договора аренды короче горизонта расчёта — условия продления могут измениться");
        if (s.Kind == "purchase") risks.Add("Стоимость интеграции с WMS может отличаться после обследования");

        if (e.PaybackYears is not { } p)
            return new Verdict("negative", "Не окупается", "Экономия на персонале не покрывает расходы на роботов.", risks);
        if (p > horizon) risks.Add("Окупаемость дольше горизонта расчёта");
        if (p < Norms.PaybackGoodYears)
            return new Verdict("good", "Окупается быстро",
                "Срок окупаемости до 3 лет — проект привлекателен для пилотного внедрения.", risks);
        if (p <= Norms.PaybackModerateYears)
            return new Verdict("moderate", "Умеренная окупаемость",
                "Срок окупаемости 3–5 лет — решение стоит принимать с учётом стратегии развития объекта.", risks);
        return new Verdict("poor", "Долгая окупаемость",
            "Срок окупаемости более 5 лет — рассмотрите аренду или другой тип робота.", risks);
    }

    private static List<CashflowYear> Cashflow(EconomicsValues e, int horizon)
    {
        var years = new List<CashflowYear> { new(0, Js.Dec(e.CapexRub), 0, 0, Js.Dec(-e.CapexRub)) };
        var cumulative = -e.CapexRub;
        for (var year = 1; year <= horizon; year++)
        {
            cumulative += e.AnnualEffectRub;
            years.Add(new CashflowYear(year, 0, Js.Dec(e.OpexAnnualRub), Js.Dec(e.AnnualEffectRub), Js.Dec(cumulative)));
        }
        return years;
    }

    private static Metric M(
        string label, double? value, string unit, string formula, bool overridden = false,
        IReadOnlyList<MetricBreakdownItem>? breakdown = null, IReadOnlyDictionary<string, double>? inputs = null) =>
        new(label, Js.Dec(value), unit, formula, breakdown, inputs, overridden);

    private static ScenarioMetrics Metrics(Computed c, ModelInputs inputs)
    {
        var e = c.Econ;
        var a = inputs.Assumptions;
        var horizon = new Dictionary<string, double> { ["horizonYears"] = a.HorizonYears };
        return new ScenarioMetrics(
            RobotCount: M("Количество роботов", e.RobotCount, "шт.",
                "⌈Целевая производительность / (Производительность робота × Загрузка × Готовность)⌉ × (1 + Резерв)",
                c.CountOverridden, inputs: new Dictionary<string, double>
                {
                    ["targetPerHour"] = Js.Round(inputs.TargetPerHour), ["utilization"] = a.Utilization,
                    ["availability"] = a.Availability, ["reserveShare"] = a.ReserveShare,
                }),
            CapexRub: M("Капитальные затраты", e.CapexRub, "₽", "Сумма строк спецификации оборудования и работ",
                c.PriceOverridden, breakdown: c.Equipment.Select((l, i) => new MetricBreakdownItem($"line{i + 1}", l.Item, l.TotalRub)).ToList()),
            OpexAnnualRub: M("Операционные затраты в год", e.OpexAnnualRub, "₽/год",
                "ФОТ оставшегося персонала + обслуживание, энергия и ПО роботов", c.OpexOverridden, breakdown:
                [
                    new("labor", "ФОТ оставшегося персонала", Js.Dec(e.LaborBaseRub - e.LaborSavingRub), "Параметры объекта"),
                    new("robots", "Обслуживание, аренда, энергия, ПО", Js.Dec(e.RobotOpexRub), "Каталог роботов"),
                ]),
            OpexDeltaRub: M("Изменение операционных затрат", e.OpexDeltaRub, "₽/год", "OPEX сценария − OPEX текущего состояния"),
            AnnualEffectRub: M("Годовой эффект", e.AnnualEffectRub, "₽/год", "Экономия ФОТ − расходы на роботов",
                inputs: new Dictionary<string, double>
                {
                    ["replacedStaff"] = e.ReplacedStaff, ["laborSavingRub"] = e.LaborSavingRub, ["robotOpexRub"] = e.RobotOpexRub,
                }),
            PaybackYears: M("Срок окупаемости", e.PaybackYears, "лет", "Капитальные затраты / Годовой эффект"),
            RoiPercent: M("ROI за горизонт расчёта", e.RoiPercent, "%",
                "Накопленный эффект за горизонт (Годовой эффект × Горизонт) / Капзатраты × 100 %", inputs: horizon),
            TcoRub: M("Совокупная стоимость владения", e.TcoRub, "₽", "Капзатраты + OPEX × Горизонт расчёта", inputs: horizon));
    }
}
