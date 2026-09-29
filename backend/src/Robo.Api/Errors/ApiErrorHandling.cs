using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Robo.Api.Contracts;

namespace Robo.Api.Errors;

/// <summary>
/// Единый формат ошибок ApiError { status, code, title, errors? } для всего, что контроллер
/// не вернул сам: исключения (500), нет токена (401), нет прав (403), неизвестный адрес (404),
/// некорректное тело запроса (400).
/// </summary>
public static class ApiErrorHandling
{
    public static ErrorResponse ForStatus(int status, HttpRequest request) => status switch
    {
        400 => New(400, "VALIDATION_ERROR", "Проверьте введённые данные"),
        401 => New(401, "AUTH_REQUIRED", "Войдите в систему, чтобы продолжить"),
        // Роль admin требуется только для изменения каталога
        403 when request.Path.StartsWithSegments("/api/v1/robots") =>
            New(403, "FORBIDDEN", "Изменять каталог может только администратор"),
        403 => New(403, "FORBIDDEN", "Недостаточно прав для этого действия"),
        404 => New(404, "NOT_FOUND", $"Адрес {request.Method} {request.Path} не найден"),
        405 => New(405, "VALIDATION_ERROR", $"Метод {request.Method} для адреса {request.Path} не поддерживается"),
        409 => New(409, "CONFLICT", "Данные изменились — обновите страницу и повторите"),
        415 => New(415, "VALIDATION_ERROR", "Тело запроса должно быть в формате JSON"),
        < 500 => New(status, "VALIDATION_ERROR", "Проверьте введённые данные"),
        _ => New(status, "SERVER_ERROR", "Ошибка на сервере. Повторите попытку позже"),
    };

    public static IMvcBuilder AddApiErrorResponses(this IMvcBuilder mvc) =>
        mvc.ConfigureApiBehaviorOptions(options =>
        {
            // Пустые 4xx из контроллеров (NotFound() и т.п.) оформляет UseApiErrors, а не ProblemDetails.
            options.SuppressMapClientErrors = true;
            options.InvalidModelStateResponseFactory = context =>
            {
                var errors = context.ModelState
                    .Where(e => e.Value is { Errors.Count: > 0 })
                    .SelectMany(e => e.Value!.Errors.Select(err => new ErrorDetail
                    {
                        Field = ToFieldPath(e.Key),
                        Message = string.IsNullOrEmpty(err.ErrorMessage)
                            ? "Некорректное значение"
                            : err.ErrorMessage,
                    }))
                    .ToList();
                var body = New(400, "VALIDATION_ERROR", "Проверьте введённые данные");
                body.Errors = errors;
                return new BadRequestObjectResult(body);
            };
        });

    public static WebApplication UseApiErrors(this WebApplication app)
    {
        app.UseExceptionHandler(handler => handler.Run(async context =>
        {
            var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
            if (error is not null)
                context.RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("Robo.Api.Errors").LogError(error, "Необработанная ошибка");
            await Write(context, ForStatus(500, context.Request));
        }));

        // Ответы без тела: 401/403 от авторизации, 404 неизвестного адреса, пустые NotFound().
        app.UseStatusCodePages(async context =>
            await Write(context.HttpContext, ForStatus(context.HttpContext.Response.StatusCode, context.HttpContext.Request)));

        return app;
    }

    private static ErrorResponse New(int status, string code, string title) =>
        new() { Status = status, Code = code, Title = title };

    private static Task Write(HttpContext context, ErrorResponse body)
    {
        context.Response.StatusCode = body.Status;
        return context.Response.WriteAsJsonAsync(body);
    }

    // "$.scenarios[0].robotId" или "Password" → "scenarios[0].robotId", "password"
    private static string ToFieldPath(string key)
    {
        var path = key.StartsWith("$.") ? key[2..] : key == "$" ? "" : key;
        return string.Join('.', path.Split('.').Select(JsonNamingPolicy.CamelCase.ConvertName));
    }
}
