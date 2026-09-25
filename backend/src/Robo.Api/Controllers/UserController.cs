using System.Text.Json.Serialization;
namespace Robo.Api.Contracts;

public class UserRequestLogin
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}
public class UserRequestRegister
{
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class UserResponse
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;
    [JsonPropertyName("user")]
    public UserStruct User { get; set; } = new();
}

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