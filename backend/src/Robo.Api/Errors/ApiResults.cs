using Microsoft.AspNetCore.Mvc;
using Robo.Api.Contracts;

namespace Robo.Api.Errors;

/// <summary>Ответы-ошибки контроллеров в формате ApiError (тексты — как в docs/api-examples.md).</summary>
public static class ApiResults
{
    public static ObjectResult Error(int status, string code, string title, List<ErrorDetail>? errors = null) =>
        new(new ErrorResponse { Status = status, Code = code, Title = title, Errors = errors }) { StatusCode = status };

    public static ObjectResult Invalid(List<ErrorDetail> errors) =>
        Error(400, "VALIDATION_ERROR", "Проверьте введённые данные", errors);

    /// <param name="what">«Робот», «Проект» — начало фразы «… не найден — возможно, он был удалён».</param>
    public static ObjectResult NotFound(string what) =>
        Error(404, "NOT_FOUND", $"{what} не найден — возможно, он был удалён");
}
