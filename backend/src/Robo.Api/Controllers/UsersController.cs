using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Robo.Api.Auth;
using Robo.Api.Contracts;
using Robo.Api.Data;
using Robo.Api.Data.Entities;
using Robo.Api.Errors;

namespace Robo.Api.Controllers;

[ApiController]
[Route("/api/v1/auth")]
public partial class UserController : ControllerBase
{
    private const int MinPasswordLength = 8;

    private readonly AppDbContext _db;
    private readonly JwtProvider _jwtProvider;

    public UserController(AppDbContext db, JwtProvider jwtProvider)
    {
        _db = db;
        _jwtProvider = jwtProvider;
    }

    [HttpPost("login")]
    public async Task<IActionResult> LoginUser([FromBody] UserRequestLogin request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);

        // Один ответ и для неизвестной почты, и для неверного пароля: не раскрываем, какие почты есть.
        if (user == null || string.IsNullOrEmpty(request.Password) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return ApiResults.Error(401, "INVALID_CREDENTIALS", "Неверная почта или пароль. Проверьте раскладку и Caps Lock");

        return Ok(AuthResponse(user));
    }

    [HttpPost("register")]
    public async Task<IActionResult> RegisterUser([FromBody] UserRequestRegister request)
    {
        var email = NormalizeEmail(request.Email);
        var name = request.Name?.Trim() ?? "";

        // Все ошибки полей сразу
        var errors = new List<ErrorDetail>();
        if (!EmailRegex().IsMatch(email))
            errors.Add(new ErrorDetail { Field = "email", Message = "Введите корректный адрес почты", Hint = "Например: ivanov@company.ru" });
        if (request.Password == null || request.Password.Length < MinPasswordLength)
            errors.Add(new ErrorDetail { Field = "password", Message = $"Пароль должен быть не короче {MinPasswordLength} символов", Hint = "Используйте буквы и цифры" });
        if (name.Length == 0)
            errors.Add(new ErrorDetail { Field = "name", Message = "Укажите имя", Hint = "Как к вам обращаться" });
        if (errors.Count > 0)
            return ApiResults.Invalid(errors);

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return EmailTaken();

        var user = new User
        {
            Id = Guid.NewGuid().ToString(),
            Email = email,
            Name = name,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "user",
            CreatedAt = DateTime.UtcNow
        };
        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Одновременная регистрация той же почты: сработал уникальный индекс users.email
            return EmailTaken();
        }

        return StatusCode(201, AuthResponse(user));
    }

    private UserResponse AuthResponse(User user) => new()
    {
        Token = _jwtProvider.GenerateToken(user),
        User = new UserStruct { Id = user.Id, Email = user.Email, Name = user.Name, Role = user.Role }
    };

    private static ObjectResult EmailTaken() =>
        ApiResults.Error(409, "CONFLICT", "Пользователь с такой почтой уже зарегистрирован — войдите или укажите другую почту");

    // Почта хранится и сравнивается в нижнем регистре без пробелов по краям
    private static string NormalizeEmail(string? email) => email?.Trim().ToLowerInvariant() ?? "";

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailRegex();
}
