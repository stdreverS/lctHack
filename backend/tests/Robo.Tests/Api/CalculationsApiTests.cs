using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using ClosedXML.Excel;

namespace Robo.Tests.Api;

public class CalculationsApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Fmr12Id = "b1f0a3c2-1111-4a01-9c01-000000000004";   // без производительности и аренды

    // Запрос как у фронтенда (TestData.RequestJson) с подставленным projectId
    private static JsonObject CalcRequest(string? projectId = null)
    {
        var request = JsonNode.Parse(TestData.RequestJson)!.AsObject();
        request["projectId"] = projectId;
        request["simulation"] = new JsonObject
        {
            ["engineVersion"] = "sim-1.0", ["seed"] = 42, ["throughputPerHour"] = 338, ["targetPerHour"] = 350,
            ["achievedPercent"] = 96.6, ["avgUtilization"] = 0.78, ["idleShare"] = 0.12, ["chargingShare"] = 0.1,
            ["maxQueue"] = 4, ["bottleneck"] = "Зона приёмки", ["confirmsCalculation"] = true,
        };
        return request;
    }

    private async Task<(HttpClient Client, string ProjectId)> UserWithProjectAsync()
    {
        var user = await factory.ClientAsAsync(ApiFactory.UserEmail, ApiFactory.UserPassword);
        var project = await ProjectsApiTests.CreateAsync(user, ProjectsApiTests.ProjectInput("Склад для расчёта", "warehouse"));
        return (user, project.GetProperty("id").GetString()!);
    }

    private static async Task<JsonElement[]> HistoryAsync(HttpClient client, string projectId)
    {
        var response = await client.GetAsync($"/api/v1/projects/{projectId}/calculations");
        Assert.Equal(200, (int)response.StatusCode);
        return (await response.JsonAsync()).EnumerateArray().ToArray();
    }

    [Fact]
    public async Task Guest_CalculatesWithoutSaving()
    {
        var (owner, projectId) = await UserWithProjectAsync();

        // Без токена projectId не даёт ни 401, ни сохранения — это гостевой расчёт
        var response = await factory.CreateClient().PostAsJsonAsync("/api/v1/calculations", CalcRequest(projectId));

        Assert.Equal(200, (int)response.StatusCode);
        var result = await response.JsonAsync();
        Assert.Equal(JsonValueKind.Null, result.GetProperty("calculationId").ValueKind);
        Assert.NotEmpty(result.GetProperty("scenarios").EnumerateArray());
        Assert.Empty(await HistoryAsync(owner, projectId));
    }

    [Fact]
    public async Task User_WithoutProjectId_DoesNotSave()
    {
        var (user, projectId) = await UserWithProjectAsync();

        var result = await (await user.PostAsJsonAsync("/api/v1/calculations", CalcRequest())).JsonAsync();

        Assert.Equal(JsonValueKind.Null, result.GetProperty("calculationId").ValueKind);
        Assert.Empty(await HistoryAsync(user, projectId));
    }

    [Fact]
    public async Task User_WithProject_AppendsHistoryRecord()
    {
        var (user, projectId) = await UserWithProjectAsync();
        var request = CalcRequest(projectId);

        var first = await (await user.PostAsJsonAsync("/api/v1/calculations", request)).JsonAsync();
        var second = await (await user.PostAsJsonAsync("/api/v1/calculations", request)).JsonAsync();

        var firstId = first.GetProperty("calculationId").GetString()!;
        var secondId = second.GetProperty("calculationId").GetString()!;
        Assert.NotEqual(firstId, secondId);

        // Новая запись на каждый расчёт, новые сверху
        var history = await HistoryAsync(user, projectId);
        Assert.Equal([secondId, firstId], history.Select(h => h.GetProperty("id").GetString()));
        Assert.Equal(["bestPaybackYears", "createdAt", "dataVersion", "id", "modelVersion"],
            history[0].EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal(first.GetProperty("modelVersion").GetString(), history[1].GetProperty("modelVersion").GetString());
        Assert.Equal(first.GetProperty("dataVersion").GetString(), history[1].GetProperty("dataVersion").GetString());
        Assert.Equal(JsonValueKind.Number, history[0].GetProperty("bestPaybackYears").ValueKind);

        // Запись хранит снимок запроса (со simulation) и тот же результат
        var record = await (await user.GetAsync($"/api/v1/calculations/{firstId}")).JsonAsync();
        Assert.Equal(firstId, record.GetProperty("id").GetString());
        Assert.True(JsonNode.DeepEquals(request, JsonNode.Parse(record.GetProperty("request").GetRawText())), record.GetProperty("request").GetRawText());
        Assert.Equal(first.GetRawText(), record.GetProperty("result").GetRawText());

        // lastPaybackYears в списке проектов — из последнего расчёта
        var summary = (await (await user.GetAsync("/api/v1/projects")).JsonAsync()).EnumerateArray()
            .First(p => p.GetProperty("id").GetString() == projectId);
        Assert.Equal(history[0].GetProperty("bestPaybackYears").GetDecimal(), summary.GetProperty("lastPaybackYears").GetDecimal());
    }

    [Fact]
    public async Task ForeignProjectAndCalculation_Return404()
    {
        var (owner, projectId) = await UserWithProjectAsync();
        var calcId = (await (await owner.PostAsJsonAsync("/api/v1/calculations", CalcRequest(projectId))).JsonAsync())
            .GetProperty("calculationId").GetString();
        var other = await factory.ClientAsAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        await (await other.PostAsJsonAsync("/api/v1/calculations", CalcRequest(projectId))).AssertApiErrorAsync(404, "NOT_FOUND");
        foreach (var path in new[] { "", "/export.xlsx", "/report.pdf" })
        {
            var error = await (await other.GetAsync($"/api/v1/calculations/{calcId}{path}")).AssertApiErrorAsync(404, "NOT_FOUND");
            Assert.Equal("Расчёт не найден — возможно, он был удалён", error.GetProperty("title").GetString());
        }
        Assert.Single(await HistoryAsync(owner, projectId));
    }

    [Fact]
    public async Task DeletedProject_HidesItsCalculations()
    {
        var (user, projectId) = await UserWithProjectAsync();
        var calcId = (await (await user.PostAsJsonAsync("/api/v1/calculations", CalcRequest(projectId))).JsonAsync())
            .GetProperty("calculationId").GetString();

        await user.DeleteAsync($"/api/v1/projects/{projectId}");

        await (await user.GetAsync($"/api/v1/calculations/{calcId}")).AssertApiErrorAsync(404, "NOT_FOUND");
    }

    [Fact]
    public async Task UnknownObjectTypeAndRobot_Return400()
    {
        var client = factory.CreateClient();
        var badType = CalcRequest();
        badType["objectType"] = "mine";
        var badRobot = CalcRequest();
        badRobot["scenarios"]![1]!["robotId"] = "no-such-robot";

        var typeError = await (await client.PostAsJsonAsync("/api/v1/calculations", badType)).AssertApiErrorAsync(400, "VALIDATION_ERROR");
        var robotError = await (await client.PostAsJsonAsync("/api/v1/calculations", badRobot)).AssertApiErrorAsync(400, "VALIDATION_ERROR");

        Assert.Equal(["objectType"], typeError.ErrorFields());
        Assert.Equal(["scenarios[1].robotId"], robotError.ErrorFields());
    }

    [Fact]
    public async Task RobotWithoutPerformance_Returns422UnlessCountOverridden()
    {
        var client = factory.CreateClient();
        var request = CalcRequest();
        request["scenarios"] = new JsonArray(
            new JsonObject { ["id"] = "buy", ["kind"] = "purchase", ["title"] = "Покупка", ["robotId"] = Fmr12Id });

        var error = await (await client.PostAsJsonAsync("/api/v1/calculations", request)).AssertApiErrorAsync(422, "CALCULATION_ERROR");
        Assert.Contains("ФМР-12", error.GetProperty("title").GetString());

        request["scenarios"]![0]!["overrides"] = new JsonObject { ["robotCount"] = 4 };
        Assert.Equal(200, (int)(await client.PostAsJsonAsync("/api/v1/calculations", request)).StatusCode);
    }

    [Fact]
    public async Task ExportXlsx_ReturnsWorkbook_ReportPdf_Returns501()
    {
        var (user, projectId) = await UserWithProjectAsync();
        var calcId = (await (await user.PostAsJsonAsync("/api/v1/calculations", CalcRequest(projectId))).JsonAsync())
            .GetProperty("calculationId").GetString();

        var xlsx = await user.GetAsync($"/api/v1/calculations/{calcId}/export.xlsx");
        Assert.Equal(200, (int)xlsx.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx.Content.Headers.ContentType?.MediaType);
        using var workbook = new XLWorkbook(await xlsx.Content.ReadAsStreamAsync());
        Assert.Equal(["Сводка", "Оборудование", "Денежный поток", "Подбор", "Чувствительность", "Допущения", "Параметры"],
            workbook.Worksheets.Select(w => w.Name));
        Assert.Equal(calcId, workbook.Worksheet("Сводка").Cell(1, 2).GetString());

        var pdf = await user.GetAsync($"/api/v1/calculations/{calcId}/report.pdf");
        var error = await pdf.AssertApiErrorAsync(501, "SERVER_ERROR");
        Assert.Contains("Отчёт для печати и PDF", error.GetProperty("title").GetString());

        await (await factory.CreateClient().GetAsync($"/api/v1/calculations/{calcId}/export.xlsx")).AssertApiErrorAsync(401, "AUTH_REQUIRED");
    }
}
