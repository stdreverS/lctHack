using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Robo.Api.Data.Entities;


namespace Robo.Api.Auth;

public class JwtProvider
{
    private const string SecretKey = "super-secret-key-for-robo-platform-hackathon-must-be-long";

    public string GenerateToken(User user)
    {
        var claims = new[]
        {
            new Claim("userId", user.Id),
            new Claim("email", user.Email),
            new Claim("role", user.Role)
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SecretKey));
        var credential = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: "RoboApi",
            audience: "RoboClients",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: credential
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}