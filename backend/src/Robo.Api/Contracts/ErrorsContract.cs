using System.Collections.Generic;
using System.Runtime.CompilerServices;
using Robo.Api.Controllers;

namespace Robo.Api.Contracts;

public class ErrorResponse
{
    public int Status { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<ErrorDetail> Errors { get; set; } = new();
}

public class ErrorDetail
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Hint { get; set; } = string.Empty;
}