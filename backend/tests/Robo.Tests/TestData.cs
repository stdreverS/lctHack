using System.Text.Json;
using Robo.Core.Config;
using Robo.Core.Contracts;

namespace Robo.Tests;

internal static class TestData
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>backend/config, скопированная в папку сборки тестов.</summary>
    public static string ConfigDir => Path.Combine(AppContext.BaseDirectory, "config");

    public static EngineConfig Config => ConfigLoader.Load(ConfigDir);

    /// <summary>Запрос в том виде, в каком его шлёт фронтенд (docs/api-examples.md, пример 2).</summary>
    public const string RequestJson = """
    {
      "projectId": null,
      "objectType": "warehouse",
      "processes": ["internal_transport", "receiving"],
      "params": { "areaM2": 12000, "workMode": "2x8", "unitWeightKg": 350, "aisleWidthM": 3, "note": null, "hasDock": true },
      "assumptions": {
        "horizonYears": 5, "workDaysPerYear": 250, "shiftsPerDay": 2, "hoursPerShift": 8,
        "utilization": 0.85, "availability": 0.95, "reserveShare": 0.1, "staffReplacedShare": 0.3
      },
      "scenarios": [
        { "id": "s-base", "kind": "baseline", "title": "Как сейчас", "robotId": null },
        { "id": "s-buy", "kind": "purchase", "title": "Покупка", "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
          "overrides": { "robotCount": null, "unitPriceRub": 3900000, "perfOpsPerHour": null, "maintenancePerYearRub": null } },
        { "id": "s-rent", "kind": "raas", "title": "Аренда", "robotId": "b1f0a3c2-1111-4a01-9c01-000000000001",
          "raas": { "monthlyFeePerRobotRub": 115000, "contractYears": 3, "setupRub": 4000000 } }
      ],
      "sensitivity": { "params": ["equipmentPrice", "operationsVolume", "laborCost"], "deltas": [-0.2, -0.1, 0.1, 0.2] },
      "simulation": null
    }
    """;

    public static CalcRequest Request => JsonSerializer.Deserialize<CalcRequest>(RequestJson, Json)!;

    public static readonly IReadOnlyList<RobotSpec> Robots =
    [
        new() { Id = "b1f0a3c2-1111-4a01-9c01-000000000001", Name = "Логимов AMR-600", SolutionType = "amr",
                ObjectTypes = ["warehouse"], Price = 4_200_000, RaasMonthlyPrice = 115_000,
                MaintenancePerYear = 320_000, PayloadKg = 600, PerfOpsPerHour = 45, Confirmed = true },
    ];
}
