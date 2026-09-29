using System.Security.Claims;

namespace Robo.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    /// <summary>id пользователя из токена; пустая строка — не совпадёт ни с одним владельцем.</summary>
    public static string UserId(this ClaimsPrincipal principal) =>
        principal.FindFirst(JwtProvider.UserIdClaim)?.Value ?? "";
}
