using System.Text.Json;
using Robo.Core.Contracts;

namespace Robo.Api.Data.Entities;

public class Project
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ObjectType { get; set; } = string.Empty;
    // Параметры объекта: ключ поля ObjectType.fields → число, строка, bool или null (jsonb).
    public Dictionary<string, JsonElement> Params { get; set; } = new();
    public Assumptions Assumptions { get; set; } = null!;       // jsonb
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
