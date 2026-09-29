using System.Text.Json;
using Robo.Core.Config;

namespace Robo.Tests;

public class ConfigLoaderTests
{
    [Fact]
    public void Load_ReadsThreeObjectTypes()
    {
        var types = TestData.Config.ObjectTypes;

        Assert.Equal(["warehouse", "airport", "hospital"], types.Select(t => t.Code));
        Assert.Equal(17, types[1].Fields.Count); // аэропорт по п. 3.2.1 ТЗ
        Assert.Equal(14, types[2].Fields.Count); // больница по п. 3.2.1 ТЗ
        Assert.NotNull(types[0].Layout);
        Assert.Null(types[1].Layout);
    }

    [Fact]
    public void Load_WarehouseFieldsAreComplete()
    {
        var warehouse = TestData.Config.ObjectTypes[0];
        var groups = warehouse.Groups.Select(g => g.Key).ToHashSet();

        Assert.Equal(16, warehouse.Fields.Count);
        Assert.All(warehouse.Fields, f => Assert.Contains(f.Group, groups));
        Assert.All(warehouse.Fields.Where(f => f.Type == "enum"), f => Assert.NotEmpty(f.Options!));
        Assert.Equal(JsonValueKind.Number, warehouse.Fields.Single(f => f.Key == "unitWeightKg").Default!.Value.ValueKind);
        Assert.True(warehouse.Fields.Single(f => f.Key == "unitLengthM").DefaultSource!.Confirmed);
    }

    [Fact]
    public void Load_DemoParamsMatchFields()
    {
        foreach (var type in TestData.Config.ObjectTypes)
        {
            var keys = type.Fields.Select(f => f.Key).ToHashSet();
            Assert.All(type.DemoParams.Keys, k => Assert.Contains(k, keys));
            Assert.All(type.Fields.Where(f => f.Required), f => Assert.True(type.DemoParams.ContainsKey(f.Key), $"{type.Code}: нет demoParams.{f.Key}"));
        }
    }

    [Fact]
    public void Load_ReadsNormsWithSources()
    {
        var norms = TestData.Config.Norms;

        Assert.Equal(7, norms.Get("energyTariffRub"));
        Assert.All(norms.Items, n => Assert.False(string.IsNullOrWhiteSpace(n.Source)));
        Assert.Throws<KeyNotFoundException>(() => norms.Get("unknown"));
    }

    [Fact]
    public void ObjectType_SerializesWithoutNullOptionalFields()
    {
        var json = JsonSerializer.Serialize(TestData.Config.ObjectTypes[1], TestData.Json);

        Assert.DoesNotContain("\"unit\":null", json);
        Assert.DoesNotContain("\"defaultSource\":null", json);
        Assert.Contains("\"layout\":null", json);
    }

    [Fact]
    public void LoadNorms_BrokenJson_ThrowsWithFileName()
    {
        var path = Path.Combine(Path.GetTempPath(), $"norms-{Guid.NewGuid()}.json");
        File.WriteAllText(path, "{ \"dataVersion\": ");
        try
        {
            var e = Assert.Throws<InvalidDataException>(() => ConfigLoader.LoadNorms(path));
            Assert.Contains(path, e.Message);
        }
        finally
        {
            File.Delete(path);
        }
    }
}
