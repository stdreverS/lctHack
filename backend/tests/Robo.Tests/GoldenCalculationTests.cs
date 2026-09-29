using System.Text.Json;
using System.Text.Json.Nodes;
using Robo.Core;
using Robo.Core.Contracts;

namespace Robo.Tests;

/// <summary>
/// Ядро против модели мока фронтенда. Golden/mock-calculations.json формирует
/// frontend/src/mocks/data/golden.test.ts (запрос → результат мока); здесь тот же запрос
/// считает Robo.Core, и ответ должен совпасть полностью: подбор, проверки с текстами,
/// показатели, денежный поток, чувствительность, допущения.
/// Отличаются только modelVersion (mock-1.0 / econ-1.0+rec-1.0) и calculatedAt.
/// </summary>
public class GoldenCalculationTests
{
    private static readonly JsonArray Cases = JsonNode.Parse(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Golden", "mock-calculations.json")))!.AsArray();

    public static TheoryData<string> CaseNames => new(Cases.Select(c => (string)c!["name"]!));

    private static JsonObject Case(string name) => Cases.Single(c => (string)c!["name"]! == name)!.AsObject();

    private static CalcResult Calculate(string name)
    {
        var request = Case(name)["request"].Deserialize<CalcRequest>(TestData.Json)!;
        return CalculationEngine.Calculate(request, TestData.Robots, TestData.Config);
    }

    [Theory]
    [MemberData(nameof(CaseNames))]
    public void CoreMatchesMock(string name)
    {
        var expected = Case(name)["result"]!.DeepClone().AsObject();
        var actual = JsonSerializer.SerializeToNode(Calculate(name), TestData.Json)!.AsObject();
        foreach (var node in new[] { expected, actual })
        {
            node.Remove("modelVersion");
            node.Remove("calculatedAt");
        }

        var diff = FirstDifference(expected, actual, "result");
        Assert.True(diff == null, diff);
    }

    [Fact]
    public void WarehouseDemo_Amr600Purchase()
    {
        // docs/economics.md, пример: 15 × «Логимов AMR-600»
        var purchase = Calculate("warehouse-demo").Scenarios.Single(s => s.Kind == "purchase").Metrics;

        Assert.Equal(15m, purchase.RobotCount.Value);
        Assert.Equal(70_050_000m, purchase.CapexRub.Value);
        Assert.Equal(16_008_000m, purchase.AnnualEffectRub.Value);
        Assert.Equal(4.38m, purchase.PaybackYears.Value);
        Assert.Equal(114.3m, purchase.RoiPercent.Value);
        Assert.Equal(354_810_000m, purchase.TcoRub.Value);
    }

    [Fact]
    public void ModelVersion_IsEconAndRec()
    {
        Assert.Equal("econ-1.0+rec-1.0", Calculate("warehouse-demo").ModelVersion);
    }

    /// <summary>Путь к первому расхождению и оба значения — чтобы было видно, где разошлась модель.</summary>
    private static string? FirstDifference(JsonNode? expected, JsonNode? actual, string path)
    {
        switch (expected, actual)
        {
            case (JsonObject e, JsonObject a):
                foreach (var key in e.Select(p => p.Key).Union(a.Select(p => p.Key)))
                {
                    if (!e.ContainsKey(key) || !a.ContainsKey(key))
                        return $"{path}.{key}: в {(e.ContainsKey(key) ? "ядре" : "моке")} нет ключа";
                    if (FirstDifference(e[key], a[key], $"{path}.{key}") is { } d) return d;
                }
                return null;
            case (JsonArray e, JsonArray a):
                if (e.Count != a.Count) return $"{path}: элементов в моке {e.Count}, в ядре {a.Count}";
                for (var i = 0; i < e.Count; i++)
                    if (FirstDifference(e[i], a[i], $"{path}[{i}]") is { } d) return d;
                return null;
            default:
                return JsonNode.DeepEquals(expected, actual)
                    ? null
                    : $"{path}: мок {expected?.ToJsonString() ?? "null"}, ядро {actual?.ToJsonString() ?? "null"}";
        }
    }
}
