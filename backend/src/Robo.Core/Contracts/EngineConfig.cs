using Robo.Core.Config;

namespace Robo.Core.Contracts;

/// <summary>
/// Справочные данные для ядра: типы объектов и нормативы. Загружается один раз при старте
/// через <see cref="ConfigLoader.Load"/> из backend/config.
/// </summary>
public sealed record EngineConfig(
    IReadOnlyList<ObjectTypeConfig> ObjectTypes,
    NormsConfig Norms)
{
    /// <summary>Версия данных для CalcResult.dataVersion.</summary>
    public string DataVersion => Norms.DataVersion;
}
