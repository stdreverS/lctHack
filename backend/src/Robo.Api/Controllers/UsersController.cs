using System.Security.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.HttpSys;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens.Experimental;
using Npgsql.Internal.Postgres;
using Robo.Api.Auth;
using Robo.Api.Contracts;
using Robo.Api.Data;

namespace Robo.Api.Controllers;


[ApiController]
[Route("/api/v1/auth")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;

    UserController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost("login")]
    public async Task<IActionResult> LoginUser([FromBody] UserRequestLogin request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(r => r.Email == request.Email);
        if (user == null)
            return StatusCode(401, new ErrorResponse
            {
                Status = 401,
                Code = "INVALID_CREDENTIALS",
                Title = "Проверьте данные",
                Errors = new List<ErrorDetail>
                {
                    new ErrorDetail
                    {
                        Field = "email",
                        Message ="Неверная почта.",
                        Hint =  "Проверьте раскладку и Caps Lock"
                    }
                }
            });

        bool isValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if (!isValid)
            return StatusCode(401, new ErrorResponse
            {
                Status = 401,
                Code = "INVALID_CREDENTIALS",
                Title = "Проверьте данные",
                Errors = new List<ErrorDetail>
                {
                    new ErrorDetail
                    {
                        Field = "password",
                        Message ="Неверный пароль.",
                        Hint =  "Проверьте раскладку и Caps Lock"
                    }
                }
            });


        var jwtProvider = new JwtProvider();
        var tokenStr = jwtProvider.GenerateToken(user);
        var response = new UserResponse
        {
            Token = tokenStr,
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

    [HttpPost("register")]
    public async Task<IActionResult> RegisterUser([FromBody] UserRequestRegister request)
    {
        if (request.Email.Length == 0)
            return StatusCode(400, new ErrorResponse
            {
                Status = 400,
                Code = "VALIDATION_ERROR",
                Title = "Проверьте введенные данные",
                Errors = new List<ErrorDetail>
                {
                    new ErrorDetail
                    {
                        Field = "email",
                        Message = "Введите корректные адрес почты.",
                        Hint = "Например: ivanov@compony.ru"
                    }
                }
            });
        if (request.Password.Length < 8)
            return StatusCode(400, new ErrorResponse
            {
                Status = 400,
                Code = "VALIDATION_ERROR",
                Title = "Проверьте введенные данные",
                Errors = new List<ErrorDetail>
                {
                    new ErrorDetail
                    {
                        Field = "password",
                        Message = "Введите корректные пароль.",
                        Hint = "Например пароль из не менее 8 символов"
                    }

                }
            });

        var checkUser = await _db.Users.FirstOrDefaultAsync(r => r.Email == request.Email);
        if (checkUser != null)
            return Conflict(new ErrorResponse
            {
                Status = 409,
                Code = "CONFLICT",
                Title = "Введите корректные адрес почты.",
                Errors = new List<ErrorDetail>
                {
                    new ErrorDetail
                    {
                        Field = "email",
                        Message = "Пользователь с такой почтой уже зарегестрирован.",
                        Hint = "Bойдите или укажите другую почту."
                    }
                }
            });


        var newUserId = Guid.NewGuid().ToString();
        _db.Users.Add(new Data.Entities.User
        {
            Id = newUserId,
            Email = request.Email,
            Name = request.Name,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "user",
            CratedAt = DateTime.UtcNow.ToString()
        });
        await _db.SaveChangesAsync();

        var response = new UserResponse
        {
            Token = "",
            User = new UserStruct
            {
                Id = newUserId,
                Email = request.Email,
                Name = request.Name,
                Role = "user"
            }
        };
        return StatusCode(201, response);
    }

}