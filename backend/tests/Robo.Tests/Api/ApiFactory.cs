using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Robo.Api.Data;

namespace Robo.Tests.Api;

/// <summary>
/// Robo.Api целиком (маршруты, авторизация, обработка ошибок) на InMemory-базе вместо PostgreSQL.
/// При старте Program заливает seed: 10 роботов и демо-учётки. Своя база на каждый экземпляр.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string UserEmail = "user@demo.ru";
    public const string UserPassword = "Demo12345";
    public const string AdminEmail = "admin@demo.ru";
    public const string AdminPassword = "Admin12345";

    private readonly string _dbName = "robo-tests-" + Guid.NewGuid();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Development: строка подключения и Jwt:Secret из appsettings.Development.json
        builder.UseEnvironment("Development");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(_dbName));
        });
    }

    public async Task<HttpClient> ClientAsAsync(string email, string password)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var token = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}

internal static class HttpJson
{
    public static async Task<JsonElement> JsonAsync(this HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    /// <summary>Проверка тела ApiError: статус в теле совпадает с HTTP, код — ожидаемый.</summary>
    public static async Task<JsonElement> AssertApiErrorAsync(this HttpResponseMessage response, int status, string code)
    {
        Assert.Equal(status, (int)response.StatusCode);
        var body = await response.JsonAsync();
        Assert.Equal(status, body.GetProperty("status").GetInt32());
        Assert.Equal(code, body.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("title").GetString()));
        return body;
    }

    public static string[] ErrorFields(this JsonElement apiError) =>
        apiError.GetProperty("errors").EnumerateArray().Select(e => e.GetProperty("field").GetString()!).ToArray();
}
