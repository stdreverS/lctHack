using System.Security.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.HttpSys;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens.Experimental;
using Npgsql.Internal.Postgres;
using Robo.Api.Contracts;
using Robo.Api.Data;

namespace Robo.Api.Controllers;

public class ErrorParam
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Hint { get; set; } = string.Empty;
}

[ApiController]
[Route("/api/v1/auth")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;
    private string _nextId { get; set; } = string.Empty;

    UserController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost("/login")]
    public async Task<IActionResult> LoginUser([FromBody] UserRequestLogin request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(r => r.Email == request.Email);
        if (user == null)
            return StatusCode(401, new { status = "401", code = "INVALID_CREDENTIALS", title = "Неверная почта или пароль. Проверьте раскладку и Caps Lock" });

        if (request.Password != user.PasswordHash)
            return StatusCode(401, new { status = "401", code = "INVALID_CREDENTIALS", title = "Неверная почта или пароль. Проверьте раскладку и Caps Lock" });

        var response = new UserResponse
        {
            Token = "",
            User = new UserStruct
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.Name,
                Role = user.Role
            }
        };
        return Ok(response);
    }

    [HttpPost("/register")]
    public async Task<IActionResult> RegisterUser([FromBody] UserRequestRegister request)
    {
        if (request.Email.Length == 0)
            return StatusCode(400, new
            {
                status = 400,
                code = "VALIDATION_ERROR",
                title = "Проверьте введенные данные",
                errors = new ErrorParam
                {
                    Field = "email",
                    Message = "Введите корректные адрес почты",
                    Hint = "Например: ivanov@compony.ru"
                }
            });
        if (request.Password.Length < 8)
            return StatusCode(400, new
            {
                status = 400,
                code = "VALIDATION_ERROR",
                title = "Проверьте введенные данные",
                errors = new ErrorParam
                {
                    Field = "password",
                    Message = "Пароль должен быть не короче 8 символов",
                    Hint = "Используйте буквы и цифры"
                }
            });

        var checkUser = await _db.Users.FirstOrDefaultAsync(r => r.Email == request.Email);
        if (checkUser != null)
            return Conflict(new
            {
                status = 409,
                code = "CONFLICT",
                title = "Пользователь с такой почтой уже зарегестрирован - войдите или укажите другую почту"
            });



        _db.Users.Add(new Data.Entities.User
        {
            Id = _nextId,
            Email = request.Email,
            Name = request.Name,
            PasswordHash = request.Password,
            Role = "user",
            CratedAt = DateTime.UtcNow.ToString()
        });

        var response = new UserResponse
        {
            Token = "",
            User = new UserStruct
            {
                Id = _nextId,
                Email = request.Email,
                Name = request.Name,
                Role = "user"
            }
        };
        return StatusCode(201, response);
    }

}