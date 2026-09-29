using System.Text.Json.Nodes;

namespace Robo.Tests.Api;

public class ObjectTypesApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Get_ReturnsObjectTypesFromConfigFile()
    {
        var response = await factory.CreateClient().GetAsync("/api/v1/object-types");

        Assert.Equal(200, (int)response.StatusCode);
        var actual = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        var expected = JsonNode.Parse(File.ReadAllText(Path.Combine(TestData.ConfigDir, "object-types.json")))!;

        Assert.Equal(["warehouse", "airport", "hospital"], actual.AsArray().Select(t => (string)t!["code"]!));
        // Содержимое совпадает с файлом; необязательные поля со значением null в ответе опускаются
        Assert.True(JsonNode.DeepEquals(WithoutNulls(expected), WithoutNulls(actual)));
    }

    private static JsonNode? WithoutNulls(JsonNode? node) => node switch
    {
        JsonObject obj => new JsonObject(obj
            .Where(p => p.Value is not null)
            .Select(p => KeyValuePair.Create(p.Key, WithoutNulls(p.Value)))),
        JsonArray arr => new JsonArray(arr.Select(WithoutNulls).ToArray()),
        _ => node?.DeepClone(),
    };
}
