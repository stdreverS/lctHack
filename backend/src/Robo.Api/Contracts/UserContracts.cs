using System.Text.Json.Serialization;
namespace Robo.Api.Contracts;

// LoginRequest, RegisterRequest, AuthResponse, User из контракта (CLAUDE.md, раздел 5).
// Поля запросов nullable: пропуски и null проверяет контроллер с русскими сообщениями.
public class UserRequestLogin
{
    [JsonPropertyName("email")]
    public string? Email { get; set; }
    [JsonPropertyName("password")]
    public string? Password { get; set; }
}
public class UserRequestRegister
{
    [JsonPropertyName("email")]
    public string? Email { get; set; }
    [JsonPropertyName("password")]
    public string? Password { get; set; }
    [JsonPropertyName("name")]
    public string? Name { get; set; }
}

public class UserResponse
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;
    [JsonPropertyName("user")]
    public UserStruct User { get; set; } = new();
}

// Публичные данные пользователя: без хэша пароля.
public class UserStruct
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;
}
