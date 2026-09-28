using System.Text.Json;
using Robo.Core;

namespace Robo.Tests;

public class CalculationEngineTests
{
    private static Robo.Core.Contracts.CalcResult Run() =>
        CalculationEngine.Calculate(TestData.Request, TestData.Robots, TestData.Config);

    [Fact]
    public void Calculate_ReturnsNonEmptyResult()
    {
        var result = Run();

        Assert.Equal("econ-0.1-stub", result.ModelVersion);
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
        Assert.Equal(70_050_000m, scenarios[1].Metrics.CapexRub.Value);
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
}
