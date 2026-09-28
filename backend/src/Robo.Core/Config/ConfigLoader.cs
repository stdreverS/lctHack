using System.Text.Json;
using Robo.Core.Contracts;

namespace Robo.Core.Config;

/// <summary>Чтение backend/config/*.json. Ошибка формата — исключение с именем файла.</summary>
public static class ConfigLoader
{
    public const string ObjectTypesFile = "object-types.json";
    public const string NormsFile = "norms.json";

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <param name="configDir">Папка с object-types.json и norms.json.</param>
    public static EngineConfig Load(string configDir) =>
        new(LoadObjectTypes(Path.Combine(configDir, ObjectTypesFile)),
            LoadNorms(Path.Combine(configDir, NormsFile)));

    public static IReadOnlyList<ObjectTypeConfig> LoadObjectTypes(string path) =>
        Read<List<ObjectTypeConfig>>(path);

    public static NormsConfig LoadNorms(string path) => Read<NormsConfig>(path);

    private static T Read<T>(string path)
    {
        using var stream = File.OpenRead(path);
        try
        {
            return JsonSerializer.Deserialize<T>(stream, Options)
                ?? throw new InvalidDataException($"Файл конфигурации пуст: {path}");
        }
        catch (JsonException e)
        {
            throw new InvalidDataException($"Ошибка в файле конфигурации {path}: {e.Message}", e);
        }
    }
}
