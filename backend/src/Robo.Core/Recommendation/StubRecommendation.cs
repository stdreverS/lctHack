using Robo.Core.Contracts;

namespace Robo.Core.Recommendation;

/// <summary>
/// Фиксированный подбор для демо-склада (заглушка). Id роботов — как в демо-каталоге
/// frontend/src/mocks/data/robots.ts. Порядок: recommended → needs_check → excluded.
/// Разделитель разрядов в сообщениях — неразрывный пробел, как у Intl.NumberFormat('ru-RU').
/// </summary>
internal static class StubRecommendation
{
    public const string Amr600Id = "b1f0a3c2-1111-4a01-9c01-000000000001";

    private static Check Payload(string result, double actual, string message) =>
        new("payload", "Грузоподъёмность", true, result, 350, actual, "кг", message);

    // Требование задаёт робот (minAisleM), фактическое значение — ширина прохода на объекте.
    private static Check Aisle(string result, double? robotMinAisleM, string message) =>
        new("aisle", "Ширина прохода", true, result, robotMinAisleM, 3, "м", message);

    private static Check Performance(string result, double? actual, string message) =>
        new("performance", "Производительность", true, result, 447, actual, "опер./ч", message);

    private static Check Autonomy(string result, double? actual, string message) =>
        new("autonomy", "Автономность", false, result, 8, actual, "ч", message);

    private static readonly Check Confirmed =
        new("dataConfirmed", "Достоверность данных", false, "pass", null, null, null, "Характеристики подтверждены источником");

    private static readonly Check NotConfirmed =
        new("dataConfirmed", "Достоверность данных", false, "unknown", null, null, null, "Характеристики не подтверждены — используйте оценку с осторожностью");

    private static readonly Check AutonomyUnknown = Autonomy("unknown", null, "Время автономной работы не указано");

    private static ScoreFactor[] Score(double economy, double performance, double fit, double dataQuality, double availability) =>
    [
        Factor("economy", "Экономика (окупаемость)", 0.35, economy),
        Factor("performance", "Производительность", 0.25, performance),
        Factor("fit", "Соответствие объекту", 0.2, fit),
        Factor("dataQuality", "Полнота и достоверность данных", 0.1, dataQuality),
        Factor("availability", "Доступность поставки", 0.1, availability),
    ];

    private static ScoreFactor Factor(string factor, string label, double weight, double value) =>
        new(factor, label, weight, value, Math.Round(weight * value, 1));

    public static readonly IReadOnlyList<RecommendationItem> Items =
    [
        new("b1f0a3c2-1111-4a01-9c01-000000000001", "Логимов AMR-600", "amr", "recommended", 74.4,
            [
                Payload("pass", 600, "Грузоподъёмность 600 кг достаточна для единицы 350 кг"),
                Aisle("pass", 1.2, "Роботу нужно 1,2 м, на объекте 3 м"),
                Performance("pass", 45, "Целевые 447 опер./ч обеспечат 15 роб."),
                Autonomy("pass", 10, "Заряда хватает на смену (10 ч)"),
                Confirmed,
            ],
            Score(34, 100, 100, 100, 75), []),
        new("b1f0a3c2-1111-4a01-9c01-000000000002", "Логимов AMR-1500", "amr", "recommended", 57,
            [
                Payload("pass", 1500, "Грузоподъёмность 1\u00A0500 кг достаточна для единицы 350 кг"),
                Aisle("pass", 1.8, "Роботу нужно 1,8 м, на объекте 3 м"),
                Performance("pass", 35, "Целевые 447 опер./ч обеспечат 18 роб."),
                Autonomy("pass", 8, "Заряда хватает на смену (8 ч)"),
                Confirmed,
            ],
            Score(0, 78, 100, 100, 75), []),
        new("b1f0a3c2-1111-4a01-9c01-000000000006", "Тягач АТ-3000", "tugger", "recommended", 54.3,
            [
                Payload("pass", 3000, "Грузоподъёмность 3\u00A0000 кг достаточна для единицы 350 кг"),
                Aisle("pass", 2.5, "Роботу нужно 2,5 м, на объекте 3 м"),
                Performance("pass", 30, "Целевые 447 опер./ч обеспечат 21 роб."),
                Autonomy("pass", 9, "Заряда хватает на смену (9 ч)"),
                Confirmed,
            ],
            Score(0, 67, 100, 100, 75), []),
        new("b1f0a3c2-1111-4a01-9c01-000000000005", "Штабелер АШ-12", "stacker", "recommended", 48.5,
            [
                Payload("pass", 1200, "Грузоподъёмность 1\u00A0200 кг достаточна для единицы 350 кг"),
                Aisle("pass", 2.6, "Роботу нужно 2,6 м, на объекте 3 м"),
                Performance("pass", 20, "Целевые 447 опер./ч обеспечат 31 роб."),
                Autonomy("pass", 8, "Заряда хватает на смену (8 ч)"),
                Confirmed,
            ],
            Score(0, 44, 100, 100, 75), []),
        new("b1f0a3c2-1111-4a01-9c01-000000000007", "Тягач АТ-1000 Лайт", "tugger", "needs_check", 39.6,
            [
                Payload("pass", 1000, "Грузоподъёмность 1\u00A0000 кг достаточна для единицы 350 кг"),
                Aisle("unknown", null, "Нет данных о минимальной ширине прохода — запросите у производителя"),
                Performance("pass", 28, "Целевые 447 опер./ч обеспечат 22 роб."),
                AutonomyUnknown,
                NotConfirmed,
            ],
            Score(26, 62, 40, 40, 30),
            ["Минимальная ширина прохода", "Время автономной работы", "Время зарядки", "Срок службы"]),
        new("b1f0a3c2-1111-4a01-9c01-000000000004", "ФМР-12 Узкопроходный", "fmr", "needs_check", 33.5,
            [
                Payload("pass", 1200, "Грузоподъёмность 1\u00A0200 кг достаточна для единицы 350 кг"),
                Aisle("pass", 1.9, "Роботу нужно 1,9 м, на объекте 3 м"),
                Performance("unknown", null, "Производительность не указана — число роботов нельзя оценить"),
                AutonomyUnknown,
                NotConfirmed,
            ],
            Score(40, 0, 40, 40, 75),
            ["Производительность", "Время автономной работы", "Время зарядки", "Срок службы"]),
        new("b1f0a3c2-1111-4a01-9c01-000000000003", "Автопогрузчик ФМР-16", "fmr", "excluded", null,
            [
                Payload("pass", 1600, "Грузоподъёмность 1\u00A0600 кг достаточна для единицы 350 кг"),
                Aisle("fail", 3.2, "Роботу нужен проход 3,2 м, а на объекте только 3 м"),
                Performance("pass", 22, "Целевые 447 опер./ч обеспечат 29 роб."),
                Autonomy("pass", 8, "Заряда хватает на смену (8 ч)"),
                Confirmed,
            ],
            [], []),
        new("b1f0a3c2-1111-4a01-9c01-000000000009", "Шаттл-система АСХ-Шаттл", "asrs", "excluded", null,
            [
                Payload("fail", 50, "Грузоподъёмность 50 кг меньше массы единицы 350 кг"),
                Performance("pass", 600, "Целевые 447 опер./ч обеспечат 2 роб."),
                AutonomyUnknown,
                Confirmed,
            ],
            [], ["Минимальная ширина прохода", "Время автономной работы", "Время зарядки"]),
    ];
}
