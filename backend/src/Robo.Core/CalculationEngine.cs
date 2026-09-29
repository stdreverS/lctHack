// Расчётное ядро: подбор (rec-1.0) и экономика (econ-1.0). Формулы — docs/economics.md и
// docs/recommendation.md; коэффициенты — backend/config/norms.json. Модель совпадает с моделью
// мока фронтенда: общий эталон — backend/tests/Robo.Tests/Golden/mock-calculations.json.
using Robo.Core.Contracts;
using Robo.Core.Economics;
using Robo.Core.Recommendation;

namespace Robo.Core;

public static class CalculationEngine
{
    public const string ModelVersion = EconomicsModel.Version + "+" + RecommendationEngine.Version;

    public const string Disclaimer =
        "Предварительная оценка, требует верификации при обследовании объекта. " +
        "Расчёт основан на введённых параметрах и каталожных данных и не является инвестиционным решением: " +
        "перед закупкой нужны коммерческие предложения поставщиков.";

    private static readonly ScenarioInput DefaultBaseline = new("baseline", "baseline", "Текущее состояние", null);

    /// <summary>
    /// Подбор роботов, экономика по сценариям и чувствительность.
    /// Чистая функция: ничего не сохраняет, calculationId в ответе всегда null — его подставляет API.
    /// </summary>
    /// <param name="request">Запрос клиента (POST /calculations).</param>
    /// <param name="robots">Каталог роботов из БД; порядок влияет на порядок роботов с равным баллом.</param>
    /// <param name="config">Типы объектов и нормативы из backend/config.</param>
    /// <exception cref="CalculationException">Расчёт невозможен по данным (422).</exception>
    public static CalcResult Calculate(CalcRequest request, IReadOnlyList<RobotSpec> robots, EngineConfig config)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(robots);
        ArgumentNullException.ThrowIfNull(config);

        var model = new EconomicsModel(ModelNorms.From(config.Norms));
        var calculator = new ScenarioCalculator(model);
        var inputs = model.ReadInputs(request.Params, request.Assumptions);
        RobotSpec? RobotOf(ScenarioInput s) => robots.FirstOrDefault(r => r.Id == s.RobotId);

        // Без сценариев считаются подбор и текущее состояние
        IReadOnlyList<ScenarioInput> scenarios = request.Scenarios.Count > 0 ? request.Scenarios : [DefaultBaseline];

        var results = scenarios.Select(s => calculator.Scenario(s, RobotOf(s), inputs)).ToList();
        var sensitivity = scenarios
            .Where(s => s.Kind != "baseline")
            .SelectMany(s => calculator.Sensitivity(s, RobotOf(s), inputs, request.Sensitivity))
            .ToList();

        return new CalcResult(
            CalculationId: null,
            ModelVersion: ModelVersion,
            DataVersion: config.DataVersion,
            CalculatedAt: DateTime.UtcNow,
            Disclaimer: Disclaimer,
            Recommendation: new RecommendationEngine(model).Build(robots, request.ObjectType, request.Processes, request.Params, inputs),
            Scenarios: results,
            Sensitivity: sensitivity,
            AssumptionsUsed: AssumptionsReport.Build(inputs, config.Norms));
    }
}
