using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Robo.Tests.Api;

public class AuthApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Login_ReturnsTokenAndPublicUser()
    {
        // Почта сравнивается без учёта регистра и пробелов по краям
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = "  User@Demo.RU ", password = ApiFactory.UserPassword });

        Assert.Equal(200, (int)response.StatusCode);
        var body = await response.JsonAsync();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("token").GetString()));
        var user = body.GetProperty("user");
        Assert.Equal(["email", "id", "name", "role"], user.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal(ApiFactory.UserEmail, user.GetProperty("email").GetString());
        Assert.Equal("user", user.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Login_WrongPasswordAndUnknownEmail_ReturnSameError()
    {
        var wrongPassword = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = ApiFactory.UserEmail, password = "Wrong12345" });
        var unknownEmail = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = "nobody@demo.ru", password = ApiFactory.UserPassword });

        var a = await wrongPassword.AssertApiErrorAsync(401, "INVALID_CREDENTIALS");
        var b = await unknownEmail.AssertApiErrorAsync(401, "INVALID_CREDENTIALS");
        Assert.Equal(a.GetRawText(), b.GetRawText());
    }

    [Fact]
    public async Task Register_ReturnsWorkingToken()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register",
            new { email = " Petrov@Company.ru", password = "Secret123", name = " Пётр Петров " });

        Assert.Equal(201, (int)response.StatusCode);
        var body = await response.JsonAsync();
        var user = body.GetProperty("user");
        Assert.Equal("petrov@company.ru", user.GetProperty("email").GetString());
        Assert.Equal("Пётр Петров", user.GetProperty("name").GetString());
        Assert.Equal("user", user.GetProperty("role").GetString());
        Assert.False(user.TryGetProperty("passwordHash", out _));

        // Токен сразу открывает закрытые эндпоинты
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/projects");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
        Assert.Equal(200, (int)(await _client.SendAsync(request)).StatusCode);

        // И пользователь может войти с этим паролем
        var login = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = "petrov@company.ru", password = "Secret123" });
        Assert.Equal(200, (int)login.StatusCode);
    }

    [Fact]
    public async Task Register_TakenEmail_Returns409()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register",
            new { email = "ADMIN@demo.ru", password = "Secret123", name = "Двойник" });

        await response.AssertApiErrorAsync(409, "CONFLICT");
    }

    [Fact]
    public async Task Register_ShortPassword_Returns400WithField()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register",
            new { email = "short@company.ru", password = "1234567", name = "Иван" });

        var error = await response.AssertApiErrorAsync(400, "VALIDATION_ERROR");
        Assert.Equal(["password"], error.ErrorFields());
    }

    [Fact]
    public async Task Register_ReturnsAllFieldErrorsAtOnce()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register",
            new { email = "not-an-email", password = (string?)null, name = "  " });

        var error = await response.AssertApiErrorAsync(400, "VALIDATION_ERROR");
        Assert.Equal(["email", "password", "name"], error.ErrorFields());
    }
}
