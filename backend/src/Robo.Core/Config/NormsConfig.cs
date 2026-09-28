namespace Robo.Core.Config;

/// <summary>Норматив или демо-оценка с источником (backend/config/norms.json).</summary>
public sealed record Norm(
    string Key,
    string Label,
    double Value,
    string Unit,
    string Source,
    bool Confirmed);             // false — демо-оценка, требует подтверждения

public sealed record NormsConfig
{
    public required string DataVersion { get; init; }
    public IReadOnlyList<Norm> Items { get; init; } = [];

    public Norm? Find(string key) => Items.FirstOrDefault(n => n.Key == key);

    public double Get(string key) =>
        Find(key)?.Value ?? throw new KeyNotFoundException($"В norms.json нет норматива «{key}»");
}
