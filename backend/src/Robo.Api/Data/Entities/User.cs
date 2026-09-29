namespace Robo.Api.Data.Entities;

public class User
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;   // BCrypt
    public string Role { get; set; } = "user";                  // user | admin
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
