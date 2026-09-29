using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Robo.Api.Data.Entities;

namespace Robo.Api.Auth;

public class JwtProvider
{
    public const string Issuer = "RoboApi";
    public const string Audience = "RoboClients";
    public const string UserIdClaim = "userId";
    public const string RoleClaim = "role";

    private readonly SymmetricSecurityKey _key;

    public JwtProvider(string secret)
    {
        _key = CreateKey(secret);
    }

    /// <summary>Ключ подписи из Jwt:Secret; короче 32 символов HMAC-SHA256 не примет.</summary>
    public static SymmetricSecurityKey CreateKey(string secret)
    {
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
            throw new InvalidOperationException(
                "Не задан Jwt:Secret (переменная Jwt__Secret) или он короче 32 символов");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
    }

    public string GenerateToken(User user)
    {
        var claims = new[]
        {
            new Claim(UserIdClaim, user.Id),
            new Claim("email", user.Email),
            new Claim(RoleClaim, user.Role)
        };
        var credential = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: credential
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
