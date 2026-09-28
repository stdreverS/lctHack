
using Microsoft.AspNetCore.Mvc;
using Robo.Api.Contracts;

namespace Robo.Api.Controllers;

[ApiController]
[Route("api/v1/object-types")]
public class ObjectTypes : ControllerBase
{

    public ObjectTypes() { }

    [HttpGet]
    public async Task<IActionResult> GetObjectTypes()
    {
        var filePath = Path.Combine(Directory.GetCurrentDirectory(), "..", "config", "object-types.json");
        if (!System.IO.File.Exists(filePath))
            return NotFound(new ErrorResponse
            {
                Status = 404,
                Title = "Файл конфигурации  типов объектов не найден на сервере"
            });

        var jsonContent = await System.IO.File.ReadAllTextAsync(filePath);
        return Content(jsonContent, "application/json");
    }
}