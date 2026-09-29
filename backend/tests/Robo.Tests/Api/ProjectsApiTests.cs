using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Robo.Tests.Api;

public class ProjectsApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly JsonObject Assumptions = new()
    {
        ["horizonYears"] = 5, ["workDaysPerYear"] = 250, ["shiftsPerDay"] = 2, ["hoursPerShift"] = 8,
        ["utilization"] = 0.85, ["availability"] = 0.95, ["reserveShare"] = 0.1, ["staffReplacedShare"] = 0.3,
    };

    // Параметры аэропорта: словарь с числом, строкой, boolean и null — не поля склада
    internal static JsonObject ProjectInput(string name = "Терминал B — багаж", string objectType = "airport") => new()
    {
        ["name"] = name,
        ["objectType"] = objectType,
        ["params"] = new JsonObject { ["areaM2"] = 42000, ["zone"] = "airside", ["hasSecurityCheck"] = true, ["note"] = null },
        ["assumptions"] = Assumptions.DeepClone(),
    };

    internal static async Task<JsonElement> CreateAsync(HttpClient client, JsonObject? input = null)
    {
        var response = await client.PostAsJsonAsync("/api/v1/projects", input ?? ProjectInput());
        Assert.Equal(201, (int)response.StatusCode);
        return await response.JsonAsync();
    }

    [Fact]
    public async Task WithoutToken_Returns401()
    {
        var response = await factory.CreateClient().GetAsync("/api/v1/projects");

        await response.AssertApiErrorAsync(401, "AUTH_REQUIRED");
    }

    [Fact]
    public async Task Post_ReturnsProjectInContractShape()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);

        var project = await CreateAsync(user);

        Assert.Equal(["assumptions", "createdAt", "id", "name", "objectType", "params", "updatedAt"],
            project.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal("airport", project.GetProperty("objectType").GetString());
        Assert.True(JsonNode.DeepEquals(ProjectInput()["params"], JsonNode.Parse(project.GetProperty("params").GetRawText())));
        Assert.True(JsonNode.DeepEquals(Assumptions, JsonNode.Parse(project.GetProperty("assumptions").GetRawText())));
        var createdAt = project.GetProperty("createdAt").GetString()!;
        Assert.EndsWith("Z", createdAt);
        Assert.Equal(createdAt, project.GetProperty("updatedAt").GetString());

        var stored = await (await user.GetAsync($"/api/v1/projects/{project.GetProperty("id").GetString()}")).JsonAsync();
        Assert.Equal(project.GetRawText(), stored.GetRawText());
    }

    [Fact]
    public async Task Post_Invalid_Returns400()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);

        var response = await user.PostAsJsonAsync("/api/v1/projects", ProjectInput(name: " ", objectType: "mine"));

        var error = await response.AssertApiErrorAsync(400, "VALIDATION_ERROR");
        Assert.Equal(["name", "objectType"], error.ErrorFields());
    }

    [Fact]
    public async Task GetAll_ReturnsOwnSummariesNewestFirst()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);
        var older = await CreateAsync(user, ProjectInput("Старый"));
        var newer = await CreateAsync(user, ProjectInput("Новый"));

        var list = (await (await user.GetAsync("/api/v1/projects")).JsonAsync()).EnumerateArray().ToList();

        var ids = list.Select(p => p.GetProperty("id").GetString()).ToList();
        Assert.True(ids.IndexOf(newer.GetProperty("id").GetString()) < ids.IndexOf(older.GetProperty("id").GetString()));
        var summary = list.First(p => p.GetProperty("id").GetString() == newer.GetProperty("id").GetString());
        Assert.Equal(["id", "lastPaybackYears", "name", "objectType", "updatedAt"], summary.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal(JsonValueKind.Null, summary.GetProperty("lastPaybackYears").ValueKind);
    }

    [Fact]
    public async Task Put_ReplacesInputAndKeepsCreatedAt()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);
        var project = await CreateAsync(user);
        var id = project.GetProperty("id").GetString();
        var input = ProjectInput("Терминал B — багаж и почта");
        input["params"]!["areaM2"] = 50000;

        var response = await user.PutAsJsonAsync($"/api/v1/projects/{id}", input);

        Assert.Equal(200, (int)response.StatusCode);
        var updated = await response.JsonAsync();
        Assert.Equal(id, updated.GetProperty("id").GetString());
        Assert.Equal("Терминал B — багаж и почта", updated.GetProperty("name").GetString());
        Assert.Equal(50000, updated.GetProperty("params").GetProperty("areaM2").GetInt32());
        Assert.Equal(project.GetProperty("createdAt").GetString(), updated.GetProperty("createdAt").GetString());
        Assert.True(updated.GetProperty("updatedAt").GetDateTime() >= project.GetProperty("updatedAt").GetDateTime());
    }

    [Fact]
    public async Task Copy_ReturnsNewProject()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);
        var source = await CreateAsync(user);

        var response = await user.PostAsync($"/api/v1/projects/{source.GetProperty("id").GetString()}/copy", null);

        Assert.Equal(201, (int)response.StatusCode);
        var copy = await response.JsonAsync();
        Assert.NotEqual(source.GetProperty("id").GetString(), copy.GetProperty("id").GetString());
        Assert.Equal("Терминал B — багаж (копия)", copy.GetProperty("name").GetString());
        Assert.Equal(source.GetProperty("params").GetRawText(), copy.GetProperty("params").GetRawText());
        Assert.Equal(200, (int)(await user.GetAsync($"/api/v1/projects/{copy.GetProperty("id").GetString()}")).StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesProject()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);
        var id = (await CreateAsync(user)).GetProperty("id").GetString();

        Assert.Equal(204, (int)(await user.DeleteAsync($"/api/v1/projects/{id}")).StatusCode);

        await (await user.GetAsync($"/api/v1/projects/{id}")).AssertApiErrorAsync(404, "NOT_FOUND");
    }

    [Fact]
    public async Task ForeignProject_Returns404ForEveryMethod()
    {
        var owner = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);
        var id = (await CreateAsync(owner)).GetProperty("id").GetString();
        // Другой пользователь, причём admin: чужие проекты ему тоже не видны
        var other = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        var responses = new[]
        {
            await other.GetAsync($"/api/v1/projects/{id}"),
            await other.PutAsJsonAsync($"/api/v1/projects/{id}", ProjectInput("Захват")),
            await other.PostAsync($"/api/v1/projects/{id}/copy", null),
            await other.DeleteAsync($"/api/v1/projects/{id}"),
            await other.GetAsync($"/api/v1/projects/{id}/calculations"),
        };

        foreach (var response in responses)
        {
            var error = await response.AssertApiErrorAsync(404, "NOT_FOUND");
            Assert.Equal("Проект не найден — возможно, он был удалён", error.GetProperty("title").GetString());
        }
        var otherList = (await (await other.GetAsync("/api/v1/projects")).JsonAsync()).EnumerateArray();
        Assert.DoesNotContain(otherList, p => p.GetProperty("id").GetString() == id);
        // Проект владельца не изменился и не удалён
        var stored = await (await owner.GetAsync($"/api/v1/projects/{id}")).JsonAsync();
        Assert.Equal("Терминал B — багаж", stored.GetProperty("name").GetString());
    }
}
