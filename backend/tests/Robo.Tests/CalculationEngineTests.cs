using System.Text.Json;
using Robo.Core;
using Robo.Core.Contracts;

namespace Robo.Tests;

public class CalculationEngineTests
{
    private static Robo.Core.Contracts.CalcResult Run() =>
        CalculationEngine.Calculate(TestData.Request, TestData.Robots, TestData.Config);

    [Fact]
    public void Calculate_ReturnsNonEmptyResult()
    {
        var result = Run();

        Assert.Equal("econ-1.0+rec-1.0", result.ModelVersion);
        Assert.False(string.IsNullOrWhiteSpace(result.DataVersion));
        Assert.False(string.IsNullOrWhiteSpace(result.Disclaimer));
        Assert.Null(result.CalculationId);
        Assert.NotEmpty(result.Recommendation);
        Assert.NotEmpty(result.AssumptionsUsed);
    }

    [Fact]
    public void Calculate_ReturnsExactlyThreeScenarios()
    {
        var scenarios = Run().Scenarios;

        Assert.Equal(["baseline", "purchase", "raas"], scenarios.Select(s => s.Kind));
        Assert.All(scenarios, s => Assert.Equal(6, s.Cashflow.Count)); // год 0 + горизонт 5 лет
        Assert.Null(scenarios[0].Metrics.PaybackYears.Value);
        // Параметров объёма нет → потребность 100 опер./ч → 4 робота (norms: defaultTargetPerHour).
        // Ручная цена 3 900 000 ₽: 4 × 3 900 000 + 2 станции × 350 000 + 3 500 000 + 1 800 000
        Assert.Equal(4m, scenarios[1].Metrics.RobotCount.Value);
        Assert.Equal(21_600_000m, scenarios[1].Metrics.CapexRub.Value);
        Assert.True(scenarios[1].Metrics.CapexRub.Overridden);
    }

    [Fact]
    public void Calculate_RoiIsAccumulatedEffectOverCapex()
    {
        // П. 3.5.2 ТЗ: ROI = накопленный эффект за горизонт / CAPEX × 100 %
        var scenarios = Run().Scenarios;

        Assert.Null(scenarios[0].Metrics.RoiPercent.Value);
        foreach (var s in scenarios.Skip(1))
        {
            var expected = Math.Round(s.Metrics.AnnualEffectRub.Value!.Value * 5 / s.Metrics.CapexRub.Value!.Value * 100, 1);
            Assert.Equal(expected, s.Metrics.RoiPercent.Value);
        }
    }

    [Fact]
    public void Calculate_KeepsScenarioIdsFromRequest()
    {
        var result = Run();

        Assert.Equal(["s-base", "s-buy", "s-rent"], result.Scenarios.Select(s => s.Id));
        Assert.All(result.Sensitivity, s => Assert.Contains(s.ScenarioId, new[] { "s-buy", "s-rent" }));
    }

    [Fact]
    public void Calculate_RecommendationHasAllThreeStatuses()
    {
        var statuses = Run().Recommendation.Select(r => r.Status).Distinct().Order();

        Assert.Equal(["excluded", "needs_check", "recommended"], statuses);
    }

    [Fact]
    public void Calculate_RecommendationStatusFollowsCriticalChecks()
    {
        foreach (var item in Run().Recommendation)
        {
            var critical = item.Checks.Where(c => c.Critical).ToList();
            var expected = critical.Any(c => c.Result == "fail") ? "excluded"
                : critical.Any(c => c.Result == "unknown") ? "needs_check"
                : "recommended";
            Assert.Equal(expected, item.Status);
            Assert.Equal(item.Status == "excluded", item.Score is null);
        }
    }

    [Fact]
    public void Calculate_SensitivityCoversThreeParams()
    {
        var sensitivity = Run().Sensitivity;

        Assert.Equal(["equipmentPrice", "laborCost", "operationsVolume"], sensitivity.Select(s => s.Param).Distinct().Order());
        Assert.All(sensitivity, s => Assert.Equal(4, s.Points.Count));
    }

    [Fact]
    public void CalcResult_SerializesToContractJson()
    {
        var json = JsonSerializer.Serialize(Run(), TestData.Json);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(JsonValueKind.Null, root.GetProperty("calculationId").ValueKind);
        var metrics = root.GetProperty("scenarios")[1].GetProperty("metrics");
        foreach (var key in new[] { "robotCount", "capexRub", "opexAnnualRub", "opexDeltaRub", "annualEffectRub", "paybackYears", "roiPercent", "tcoRub" })
            Assert.True(metrics.TryGetProperty(key, out _), $"нет metrics.{key}");
        // Необязательные поля контракта не выводятся как null.
        Assert.False(metrics.GetProperty("paybackYears").TryGetProperty("breakdown", out _));
        Assert.EndsWith("Z", root.GetProperty("calculatedAt").GetString());
    }

    [Fact]
    public void CalcRequest_DeserializesParamValuesOfAllKinds()
    {
        var request = TestData.Request;

        Assert.Equal(12000, request.Params["areaM2"].GetDouble());
        Assert.Equal("2x8", request.Params["workMode"].GetString());
        Assert.Equal(JsonValueKind.True, request.Params["hasDock"].ValueKind);
        Assert.Equal(JsonValueKind.Null, request.Params["note"].ValueKind);
        Assert.Equal(3_900_000m, request.Scenarios[1].Overrides!.UnitPriceRub);
        Assert.Null(request.Scenarios[1].Overrides!.RobotCount);
        Assert.Equal(115_000m, request.Scenarios[2].Raas!.MonthlyFeePerRobotRub);
    }

    [Fact]
    public void Calculate_RobotWithoutPerformance_ThrowsUnlessOverridden()
    {
        var fmr12 = TestData.Robots.Single(r => r.Name == "ФМР-12 Узкопроходный");
        var request = TestData.Request with { Scenarios = [new ScenarioInput("buy", "purchase", "Покупка", fmr12.Id)] };

        var e = Assert.Throws<CalculationException>(() => CalculationEngine.Calculate(request, TestData.Robots, TestData.Config));
        Assert.Contains("ФМР-12 Узкопроходный", e.Message);

        var manual = request with { Scenarios = [new ScenarioInput("buy", "purchase", "Покупка", fmr12.Id, new ScenarioOverrides(RobotCount: 4))] };
        Assert.Equal(4m, CalculationEngine.Calculate(manual, TestData.Robots, TestData.Config).Scenarios[0].Metrics.RobotCount.Value);
    }

    [Fact]
    public void Calculate_RaasWithoutPrice_Throws()
    {
        var fmr12 = TestData.Robots.Single(r => r.Name == "ФМР-12 Узкопроходный");
        var request = TestData.Request with
        {
            Scenarios = [new ScenarioInput("rent", "raas", "Аренда", fmr12.Id, new ScenarioOverrides(RobotCount: 4))],
        };

        var e = Assert.Throws<CalculationException>(() => CalculationEngine.Calculate(request, TestData.Robots, TestData.Config));
        Assert.Contains("нет цены аренды", e.Message);
    }

    [Fact]
    public void Calculate_TakesCoefficientsFromNorms()
    {
        // Тариф на электроэнергию ×2 — растут только расходы на роботов (формула 6)
        var config = TestData.Config;
        var norms = config.Norms with
        {
            Items = config.Norms.Items.Select(n => n.Key == "energyTariffRub" ? n with { Value = n.Value * 2 } : n).ToList(),
        };
        var baseOpex = Run().Scenarios[1].Metrics.OpexAnnualRub.Value;

        var doubled = CalculationEngine.Calculate(TestData.Request, TestData.Robots, config with { Norms = norms });

        // 4 робота × 0,6 кВт × 4000 ч × 7 ₽ = 67 200 ₽ дополнительно
        Assert.Equal(baseOpex + 67_200m, doubled.Scenarios[1].Metrics.OpexAnnualRub.Value);
        Assert.Contains(doubled.AssumptionsUsed, a => a.Key == "energyTariffRub" && Convert.ToDouble(a.Value) == 14);
    }

    [Fact]
    public void Calculate_MissingNorm_Throws()
    {
        var config = TestData.Config;
        var norms = config.Norms with { Items = config.Norms.Items.Where(n => n.Key != "peakFactor").ToList() };

        Assert.Throws<KeyNotFoundException>(() => CalculationEngine.Calculate(TestData.Request, TestData.Robots, config with { Norms = norms }));
    }
}
