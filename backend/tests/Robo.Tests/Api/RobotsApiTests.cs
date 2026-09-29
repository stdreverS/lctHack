using System.Net.Http.Json;
using System.Text.Json;

namespace Robo.Tests.Api;

/// <summary>Чтение каталога: GET /robots с фильтрами и GET /robots/{id}. Каталог не меняется.</summary>
public class RobotsReadApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Amr600Id = "b1f0a3c2-1111-4a01-9c01-000000000001";
    private const string Fmr12Id = "b1f0a3c2-1111-4a01-9c01-000000000004";   // без производительности и аренды

    private readonly HttpClient _client = factory.CreateClient();

    private async Task<JsonElement[]> ListAsync(string query = "")
    {
        var response = await _client.GetAsync("/api/v1/robots" + query);
        Assert.Equal(200, (int)response.StatusCode);
        return (await response.JsonAsync()).EnumerateArray().ToArray();
    }

    [Fact]
    public async Task GetAll_ReturnsSeededCatalog()
    {
        var robots = await ListAsync();

        Assert.Equal(10, robots.Length);
        Assert.Equal(Amr600Id, robots[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task GetAll_FiltersByObjectTypeAndSolutionType()
    {
        var robots = await ListAsync("?objectType=hospital&solutionType=amr");

        Assert.NotEmpty(robots);
        Assert.All(robots, r =>
        {
            Assert.Contains("hospital", r.GetProperty("objectTypes").EnumerateArray().Select(t => t.GetString()));
            Assert.Equal("amr", r.GetProperty("solutionType").GetString());
        });
        Assert.True(robots.Length < 10);
    }

    [Fact]
    public async Task GetAll_SearchesNameAndManufacturerIgnoringCase()
    {
        var robots = await ListAsync("?q=" + Uri.EscapeDataString("  логимов "));

        Assert.NotEmpty(robots);
        Assert.All(robots, r => Assert.Contains("Логимов",
            r.GetProperty("name").GetString() + " " + r.GetProperty("manufacturer").GetString()));
        Assert.Empty(await ListAsync("?q=nothing-like-this"));
    }

    [Fact]
    public async Task GetAll_SortsByPriceDescending()
    {
        var prices = (await ListAsync("?sort=-price")).Select(r => r.GetProperty("price").GetDecimal()).ToArray();

        Assert.Equal(prices.OrderDescending(), prices);
    }

    [Fact]
    public async Task GetAll_SortBySpecPutsNullFirst()
    {
        var perf = (await ListAsync("?sort=perfOpsPerHour")).Select(r => r.GetProperty("specs").GetProperty("perfOpsPerHour")).ToArray();

        Assert.Equal(JsonValueKind.Null, perf[0].ValueKind);
        var numbers = perf.Where(p => p.ValueKind == JsonValueKind.Number).Select(p => p.GetDouble()).ToArray();
        Assert.Equal(numbers.Order(), numbers);
    }

    [Fact]
    public async Task GetById_ReturnsRobotInContractShape()
    {
        var response = await _client.GetAsync($"/api/v1/robots/{Fmr12Id}");

        Assert.Equal(200, (int)response.StatusCode);
        var robot = await response.JsonAsync();
        Assert.Equal(
            ["availability", "confirmed", "country", "id", "maintenancePerYear", "manufacturer", "name", "objectTypes",
             "price", "raasMonthlyPrice", "solutionType", "solutionTypeName", "sourceDate", "sourceUrl", "specs"],
            robot.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal(
            ["autonomyH", "chargeTimeH", "heightM", "lengthM", "lifeYears", "minAisleM", "navigation", "payloadKg",
             "perfOpsPerHour", "positioningMm", "speedMps", "widthM"],
            robot.GetProperty("specs").EnumerateObject().Select(p => p.Name).Order());
        // null не опускается и не заменяется нулём
        Assert.Equal(JsonValueKind.Null, robot.GetProperty("raasMonthlyPrice").ValueKind);
        Assert.Equal(JsonValueKind.Null, robot.GetProperty("specs").GetProperty("perfOpsPerHour").ValueKind);
        Assert.Equal(1.9, robot.GetProperty("specs").GetProperty("minAisleM").GetDouble());
        Assert.Equal("2026-03-02", robot.GetProperty("sourceDate").GetString());
        Assert.Equal("Восток Автоматика", robot.GetProperty("manufacturer").GetString());
    }

    [Fact]
    public async Task GetById_Unknown_Returns404()
    {
        var response = await _client.GetAsync("/api/v1/robots/no-such-robot");

        var error = await response.AssertApiErrorAsync(404, "NOT_FOUND");
        Assert.Equal("Робот не найден — возможно, он был удалён", error.GetProperty("title").GetString());
    }
}

/// <summary>Изменение каталога: POST, PUT, DELETE /robots — только администратор.</summary>
public class RobotsWriteApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static object RobotInput(decimal price = 5_100_000) => new
    {
        name = "Логимов AMR-800",
        manufacturer = "Логимов Роботикс",
        solutionType = "amr",
        solutionTypeName = "AMR — автономный мобильный робот",
        objectTypes = new[] { "warehouse" },
        country = "Россия",
        availability = (string?)null,
        price,
        raasMonthlyPrice = (decimal?)null,
        maintenancePerYear = 390_000,
        specs = new { payloadKg = 800, perfOpsPerHour = (double?)null, minAisleM = 1.4, heightM = 0.35 },
        sourceUrl = "https://example.com/catalog/logimov-amr-800",
        sourceDate = "2026-09-01",
        confirmed = true,
    };

    private async Task<string> CreateAsync(HttpClient admin)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/robots", RobotInput());
        Assert.Equal(201, (int)response.StatusCode);
        return (await response.JsonAsync()).GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task Post_WithoutToken_Returns401()
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/v1/robots", RobotInput());

        await response.AssertApiErrorAsync(401, "AUTH_REQUIRED");
    }

    [Fact]
    public async Task Post_AsUser_Returns403()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);

        var response = await user.PostAsJsonAsync("/api/v1/robots", RobotInput());

        var error = await response.AssertApiErrorAsync(403, "FORBIDDEN");
        Assert.Equal("Изменять каталог может только администратор", error.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Post_Invalid_Returns400WithFieldErrors()
    {
        var admin = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        var response = await admin.PostAsJsonAsync("/api/v1/robots",
            new { name = " ", manufacturer = "Логимов", solutionType = "amr", objectTypes = new[] { "warehouse" }, price = 0, maintenancePerYear = 0 });

        var error = await response.AssertApiErrorAsync(400, "VALIDATION_ERROR");
        Assert.Equal(["name", "price"], error.ErrorFields());
    }

    [Fact]
    public async Task Post_AsAdmin_CreatesRobot()
    {
        var admin = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        var response = await admin.PostAsJsonAsync("/api/v1/robots", RobotInput());

        Assert.Equal(201, (int)response.StatusCode);
        var created = await response.JsonAsync();
        var id = created.GetProperty("id").GetString()!;
        Assert.True(Guid.TryParse(id, out _));
        Assert.Equal(JsonValueKind.Null, created.GetProperty("raasMonthlyPrice").ValueKind);
        Assert.Equal(1.4, created.GetProperty("specs").GetProperty("minAisleM").GetDouble());

        var stored = await (await factory.CreateClient().GetAsync($"/api/v1/robots/{id}")).JsonAsync();
        Assert.Equal("Логимов AMR-800", stored.GetProperty("name").GetString());
        Assert.Equal("2026-09-01", stored.GetProperty("sourceDate").GetString());
    }

    [Fact]
    public async Task Put_AsAdmin_ReturnsUpdatedRobot()
    {
        var admin = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var id = await CreateAsync(admin);

        var response = await admin.PutAsJsonAsync($"/api/v1/robots/{id}", RobotInput(price: 4_990_000));

        Assert.Equal(200, (int)response.StatusCode);
        var updated = await response.JsonAsync();
        Assert.Equal(id, updated.GetProperty("id").GetString());
        Assert.Equal(4_990_000m, updated.GetProperty("price").GetDecimal());
        var stored = await (await factory.CreateClient().GetAsync($"/api/v1/robots/{id}")).JsonAsync();
        Assert.Equal(4_990_000m, stored.GetProperty("price").GetDecimal());
    }

    [Fact]
    public async Task Put_Unknown_Returns404()
    {
        var admin = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        var response = await admin.PutAsJsonAsync("/api/v1/robots/no-such-robot", RobotInput());

        await response.AssertApiErrorAsync(404, "NOT_FOUND");
    }

    [Fact]
    public async Task Delete_AsAdmin_RemovesRobot()
    {
        var admin = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var id = await CreateAsync(admin);

        var response = await admin.DeleteAsync($"/api/v1/robots/{id}");

        Assert.Equal(204, (int)response.StatusCode);
        await (await factory.CreateClient().GetAsync($"/api/v1/robots/{id}")).AssertApiErrorAsync(404, "NOT_FOUND");
    }

    [Fact]
    public async Task Delete_AsUser_Returns403()
    {
        var admin = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var id = await CreateAsync(admin);
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);

        var response = await user.DeleteAsync($"/api/v1/robots/{id}");

        await response.AssertApiErrorAsync(403, "FORBIDDEN");
    }
}
