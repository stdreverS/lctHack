// ЗАГЛУШКА расчётного ядра. Возвращает фиксированный правдоподобный результат для демо-склада
// (числа совпадают с моком фронтенда frontend/src/mocks/data/calculation.ts).
// Формулы подбора и экономики появятся позже; сигнатура Calculate не изменится.
using Robo.Core.Contracts;
using Robo.Core.Economics;
using Robo.Core.Recommendation;

namespace Robo.Core;

public static class CalculationEngine
{
    public const string ModelVersion = "econ-0.1-stub";

    public const string Disclaimer =
        "Предварительная оценка, требует верификации при обследовании объекта. " +
        "Расчёт основан на введённых параметрах и каталожных данных и не является инвестиционным решением: " +
        "перед закупкой нужны коммерческие предложения поставщиков.";

    /// <summary>
    /// Подбор роботов, экономика по сценариям и чувствительность.
    /// Чистая функция: ничего не сохраняет, calculationId в ответе всегда null — его подставляет API.
    /// </summary>
    /// <param name="request">Запрос клиента (POST /calculations).</param>
    /// <param name="robots">Каталог роботов из БД.</param>
    /// <param name="config">Типы объектов и нормативы из backend/config.</param>
    public static CalcResult Calculate(CalcRequest request, IReadOnlyList<RobotSpec> robots, EngineConfig config)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(robots);
        ArgumentNullException.ThrowIfNull(config);

        // Заглушка берёт из запроса только id, названия и роботов сценариев,
        // чтобы фронтенд мог сопоставить ответ со своими сценариями.
        var ids = new StubScenarioIds(
            Pick(request, "baseline", new ScenarioInput("baseline", "baseline", "Текущее состояние", null)),
            Pick(request, "purchase", new ScenarioInput("purchase", "purchase", "Покупка Логимов AMR-600", StubRecommendation.Amr600Id)),
            Pick(request, "raas", new ScenarioInput("raas", "raas", "Аренда Логимов AMR-600 (RaaS)", StubRecommendation.Amr600Id)));

        return new CalcResult(
            CalculationId: null,
            ModelVersion: ModelVersion,
            DataVersion: config.DataVersion,
            CalculatedAt: DateTime.UtcNow,
            Disclaimer: Disclaimer,
            Recommendation: StubRecommendation.Items,
            Scenarios: StubScenarios.Scenarios(ids),
            Sensitivity: StubScenarios.Sensitivity(ids),
            AssumptionsUsed: StubScenarios.AssumptionsUsed);
    }

    private static ScenarioInput Pick(CalcRequest request, string kind, ScenarioInput fallback) =>
        request.Scenarios.FirstOrDefault(s => s.Kind == kind) ?? fallback;
}
