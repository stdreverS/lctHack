using System.Security.Cryptography.X509Certificates;

namespace Robo.Api.Data.Entities;

public class User
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string CratedAt { get; set; } = string.Empty;
}