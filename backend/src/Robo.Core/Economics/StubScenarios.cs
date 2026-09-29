using Robo.Core.Contracts;

namespace Robo.Core.Economics;

/// <summary>Сценарии из запроса, чьи id, названия и роботов заглушка возвращает клиенту.</summary>
internal sealed record StubScenarioIds(ScenarioInput Baseline, ScenarioInput Purchase, ScenarioInput Raas);

/// <summary>
/// Фиксированная экономика для демо-склада (заглушка): 15 × «Логимов AMR-600»,
/// горизонт 5 лет, целевые 447 опер./ч. Числа — из мока фронтенда.
/// </summary>
internal static class StubScenarios
{
    private const int Horizon = 5;
    private const decimal LaborBaseRub = 72_960_000;      // 64 чел. × 95 000 ₽ × 12
    private const decimal LaborRemainingRub = 51_300_000; // после замещения 19 чел.
    private const decimal LaborSavingRub = 21_660_000;
    private const int ReplacedStaff = 19;

    private static readonly IReadOnlyDictionary<string, double> CountInputs = new Dictionary<string, double>
    {
        ["targetPerHour"] = 447, ["utilization"] = 0.85, ["availability"] = 0.95, ["reserveShare"] = 0.1,
    };

    private static readonly IReadOnlyDictionary<string, double> HorizonInputs =
        new Dictionary<string, double> { ["horizonYears"] = Horizon };

    public static IReadOnlyList<ScenarioResult> Scenarios(StubScenarioIds ids) =>
    [
        Build(ids.Baseline, robotCount: 0, equipment: [], robotOpexRub: 0, replaced: 0,
            payback: null, roi: null,
            new Verdict("moderate", "Текущее состояние",
                "Процессы выполняет персонал, инвестиций нет. Сценарий — точка отсчёта для сравнения.",
                ["Рост фонда оплаты труда", "Нехватка персонала в пиковые периоды"])),
        Build(ids.Purchase, robotCount: 15,
            equipment:
            [
                Line("Логимов AMR-600", 15, 4_200_000),
                Line("Зарядная станция", 5, 350_000),
                Line("ПО управления парком и интеграция с WMS", 1, 3_500_000),
                Line("Пусконаладка и обучение персонала", 1, 1_800_000),
            ],
            robotOpexRub: 5_652_000, replaced: ReplacedStaff, payback: 4.38m, roi: 114.3m,
            new Verdict("moderate", "Умеренная окупаемость",
                "Срок окупаемости 3–5 лет — решение стоит принимать с учётом стратегии развития объекта.",
                ["Стоимость интеграции с WMS может отличаться после обследования"])),
        Build(ids.Raas, robotCount: 15,
            equipment: [Line("Внедрение, интеграция и подготовка площадки (RaaS)", 1, 1_500_000)],
            robotOpexRub: 20_952_000, replaced: ReplacedStaff, payback: 2.12m, roi: 236m,
            new Verdict("good", "Окупается быстро",
                "Срок окупаемости до 3 лет — проект привлекателен для пилотного внедрения.",
                ["Срок договора аренды короче горизонта расчёта — условия продления могут измениться"])),
    ];

    public static IReadOnlyList<SensitivitySeries> Sensitivity(StubScenarioIds ids) =>
    [
        Series(ids.Purchase.Id, "equipmentPrice",
            P(-0.2, 3.59m, 139.3m, 16_008_000), P(-0.1, 3.98m, 125.6m, 16_008_000),
            P(0.1, 4.77m, 104.8m, 16_008_000), P(0.2, 5.16m, 96.8m, 16_008_000)),
        Series(ids.Purchase.Id, "operationsVolume",
            P(-0.2, 4.13m, 120.9m, 12_795_200), P(-0.1, 4.68m, 106.8m, 14_064_800),
            P(0.1, 4.16m, 120.3m, 17_951_200), P(0.2, 3.96m, 126.2m, 19_894_400)),
        Series(ids.Purchase.Id, "laborCost",
            P(-0.2, 6m, 83.3m, 11_676_000), P(-0.1, 5.06m, 98.8m, 13_842_000),
            P(0.1, 3.85m, 129.7m, 18_174_000), P(0.2, 3.44m, 145.2m, 20_340_000)),
        Series(ids.Raas.Id, "equipmentPrice",
            P(-0.2, 0.31m, 1616m, 4_848_000), P(-0.1, 0.54m, 926m, 2_778_000),
            P(0.1, null, -454m, -1_362_000), P(0.2, null, -1144m, -3_432_000)),
        Series(ids.Raas.Id, "operationsVolume",
            P(-0.2, 0.86m, 578.4m, 1_735_200), P(-0.1, null, -58.4m, -175_200),
            P(0.1, 0.94m, 530.4m, 1_591_200), P(0.2, 0.61m, 824.8m, 2_474_400)),
        Series(ids.Raas.Id, "laborCost",
            P(-0.2, null, -1208m, -3_624_000), P(-0.1, null, -486m, -1_458_000),
            P(0.1, 0.52m, 958m, 2_874_000), P(0.2, 0.3m, 1680m, 5_040_000)),
    ];

    public static readonly IReadOnlyList<AssumptionRef> AssumptionsUsed =
    [
        new("horizonYears", "Горизонт расчёта", 5, "лет", "Параметры проекта", true),
        new("workDaysPerYear", "Рабочих дней в году", 250, "дн.", "Допущение: пятидневная рабочая неделя, округлённо", false),
        new("shiftsPerDay", "Смен в сутки", 2, "смен", "Параметры проекта", true),
        new("hoursPerShift", "Длительность смены", 8, "ч", "ТК РФ, ст. 91", true),
        new("utilization", "Загрузка робота", 85, "%", "Демо-оценка по отраслевой практике", false),
        new("availability", "Техническая готовность", 95, "%", "Демо-оценка по данным производителей", false),
        new("reserveShare", "Резерв парка", 10, "%", "Демо-оценка", false),
        new("staffReplacedShare", "Доля замещаемого персонала", 30, "%", "Демо-оценка", false),
        new("staffCostMonthRub", "Стоимость сотрудника", 95_000, "₽/мес", "Параметры объекта", true),
        new("energyTariffRub", "Тариф на электроэнергию", 7, "₽/кВт·ч", "Демо-оценка", false),
        new("integrationRub", "Интеграция с WMS", 3_500_000, "₽", "Демо-оценка по рынку", false),
    ];

    private static ScenarioResult Build(
        ScenarioInput input, int robotCount, IReadOnlyList<EquipmentLine> equipment,
        decimal robotOpexRub, int replaced, decimal? payback, decimal? roi, Verdict verdict)
    {
        var capex = equipment.Sum(l => l.TotalRub);
        var laborSaving = replaced > 0 ? LaborSavingRub : 0;
        var labor = replaced > 0 ? LaborRemainingRub : LaborBaseRub;
        var opex = labor + robotOpexRub;
        var effect = LaborBaseRub - opex;

        var metrics = new ScenarioMetrics(
            RobotCount: M("Количество роботов", robotCount, "шт.",
                "⌈Целевая производительность / (Производительность робота × Загрузка × Готовность)⌉ × (1 + Резерв)",
                inputs: CountInputs),
            CapexRub: M("Капитальные затраты", capex, "₽", "Сумма строк спецификации оборудования и работ",
                breakdown: equipment.Select((l, i) => new MetricBreakdownItem($"line{i + 1}", l.Item, l.TotalRub)).ToList()),
            OpexAnnualRub: M("Операционные затраты в год", opex, "₽/год",
                "ФОТ оставшегося персонала + обслуживание, энергия и ПО роботов",
                breakdown:
                [
                    new("labor", "ФОТ оставшегося персонала", labor, "Параметры объекта"),
                    new("robots", "Обслуживание, аренда, энергия, ПО", robotOpexRub, "Каталог роботов"),
                ]),
            OpexDeltaRub: M("Изменение операционных затрат", -effect, "₽/год", "OPEX сценария − OPEX текущего состояния"),
            AnnualEffectRub: M("Годовой эффект", effect, "₽/год", "Экономия ФОТ − расходы на роботов",
                inputs: new Dictionary<string, double>
                {
                    ["replacedStaff"] = replaced, ["laborSavingRub"] = (double)laborSaving, ["robotOpexRub"] = (double)robotOpexRub,
                }),
            PaybackYears: M("Срок окупаемости", payback, "лет", "Капитальные затраты / Годовой эффект"),
            RoiPercent: M("ROI за горизонт расчёта", roi, "%",
                "Накопленный эффект за горизонт (Годовой эффект × Горизонт) / Капзатраты × 100 %", inputs: HorizonInputs),
            TcoRub: M("Совокупная стоимость владения", capex + opex * Horizon, "₽",
                "Капзатраты + OPEX × Горизонт расчёта", inputs: HorizonInputs));

        return new ScenarioResult(input.Id, input.Kind, input.Title, input.RobotId,
            equipment, metrics, Cashflow(capex, opex, effect), verdict);
    }

    private static IReadOnlyList<CashflowYear> Cashflow(decimal capex, decimal opex, decimal effect)
    {
        var years = new List<CashflowYear> { new(0, capex, 0, 0, -capex) };
        for (var year = 1; year <= Horizon; year++)
            years.Add(new CashflowYear(year, 0, opex, effect, -capex + effect * year));
        return years;
    }

    private static Metric M(
        string label, decimal? value, string unit, string formula,
        IReadOnlyList<MetricBreakdownItem>? breakdown = null, IReadOnlyDictionary<string, double>? inputs = null) =>
        new(label, value, unit, formula, breakdown, inputs, Overridden: false);

    private static EquipmentLine Line(string item, int qty, decimal unitPrice) => new(item, qty, unitPrice, qty * unitPrice);

    private static SensitivityPoint P(double delta, decimal? payback, decimal roi, decimal effect) => new(delta, payback, roi, effect);

    private static SensitivitySeries Series(string scenarioId, string param, params SensitivityPoint[] points) =>
        new(scenarioId, param, param switch
        {
            "equipmentPrice" => "Стоимость оборудования",
            "operationsVolume" => "Объём операций",
            _ => "Стоимость труда",
        }, points);
}
