using Robo.Core.Contracts;

namespace Robo.Api.Data.Entities;

// Запись истории расчётов (таблица calculations): запрос и результат целиком — расчёт воспроизводим.
public class CalculationResult
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public CalcRequest Inputs { get; set; } = null!;            // jsonb
    public CalcResult Results { get; set; } = null!;            // jsonb
    public string ModelVersion { get; set; } = string.Empty;
    public string DataVersion { get; set; } = string.Empty;
    public decimal? BestPaybackYears { get; set; }
    public DateTime CreatedAt { get; set; }
}
