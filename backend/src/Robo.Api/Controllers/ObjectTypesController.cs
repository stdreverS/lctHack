using Microsoft.AspNetCore.Mvc;
using Robo.Core.Contracts;

namespace Robo.Api.Controllers;

[ApiController]
[Route("api/v1/object-types")]
public class ObjectTypes : ControllerBase
{
    private readonly EngineConfig _config;

    // EngineConfig загружает ConfigLoader при старте из Robo:ConfigDir (Program.cs)
    public ObjectTypes(EngineConfig config)
    {
        _config = config;
    }

    // Структура ObjectTypeConfig совпадает с ObjectType контракта — отдаём как есть.
    [HttpGet]
    public IActionResult GetObjectTypes() => Ok(_config.ObjectTypes);
}
