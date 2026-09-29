using System.Text.Json;
using System.Text.Json.Serialization;
using Robo.Core.Contracts;

namespace Robo.Api.Contracts;

// ProjectInput из контракта (CLAUDE.md, раздел 5): тело POST и PUT /projects.
// Поля nullable: пропуски и null проверяет ProjectsController с русскими сообщениями.
public class ProjectRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }
    [JsonPropertyName("objectType")]
    public string? ObjectType { get; set; }
    // Набор ключей задаёт тип объекта (ObjectType.fields), поэтому словарь, а не класс.
    // Значения — ParamValue: число, строка, boolean или null.
    [JsonPropertyName("params")]
    public Dictionary<string, JsonElement>? Params { get; set; }
    [JsonPropertyName("assumptions")]
    public Assumptions? Assumptions { get; set; }
}

// Project
public record ProjectResponse(
    string Id,
    string Name,
    string ObjectType,
    IReadOnlyDictionary<string, JsonElement> Params,
    Assumptions Assumptions,
    DateTime CreatedAt,
    DateTime UpdatedAt);

// ProjectSummary: строка списка проектов
public record ProjectSummary(string Id, string Name, string ObjectType, DateTime UpdatedAt, decimal? LastPaybackYears);
