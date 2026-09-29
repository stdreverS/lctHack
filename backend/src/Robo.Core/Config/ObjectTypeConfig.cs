using System.Text.Json;
using System.Text.Json.Serialization;

namespace Robo.Core.Config;

// Схема типа объекта из backend/config/object-types.json.
// Структура совпадает с ObjectType контракта (GET /object-types), поэтому API может
// отдавать эти объекты клиенту как есть. Необязательные поля (field?: T) без null в JSON.

public sealed record ProcessDef(string Code, string Name);

public sealed record FieldGroup(string Key, string Label);

public sealed record FieldOption(string Value, string Label);

public sealed record DefaultSource(string Source, bool Confirmed);

public sealed record ParamField
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public required string Group { get; init; }
    public required string Type { get; init; }      // number | integer | enum | boolean | string
    public bool Required { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? Unit { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public double? Min { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public double? Max { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public IReadOnlyList<FieldOption>? Options { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public JsonElement? Default { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public JsonElement? Example { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? Hint { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public DefaultSource? DefaultSource { get; init; }
}

public sealed record Zone(
    string Id,
    string Type,                 // receiving | storage | picking | shipping | charging | other
    string Label,
    IReadOnlyList<double> Rect,  // x, y, ширина, высота, м
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Slots = null);

public sealed record Layout(double WidthM, double HeightM, IReadOnlyList<Zone> Zones);

public sealed record ObjectTypeConfig
{
    public required string Code { get; init; }
    public required string Name { get; init; }
    public string Description { get; init; } = "";
    public IReadOnlyList<ProcessDef> Processes { get; init; } = [];
    public IReadOnlyList<FieldGroup> Groups { get; init; } = [];
    public IReadOnlyList<ParamField> Fields { get; init; } = [];
    public IReadOnlyDictionary<string, JsonElement> DemoParams { get; init; } = new Dictionary<string, JsonElement>();
    public Layout? Layout { get; init; }            // null — симуляция для типа пока недоступна
}
