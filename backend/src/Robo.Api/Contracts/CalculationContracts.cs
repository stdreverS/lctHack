using Robo.Core.Contracts;

namespace Robo.Api.Contracts;

// CalculationSummary: строка истории расчётов проекта
public record CalculationSummary(string Id, DateTime CreatedAt, string ModelVersion, string DataVersion, decimal? BestPaybackYears);

// CalculationRecord: сохранённый расчёт — запрос и результат как были
public record CalculationRecord(string Id, DateTime CreatedAt, CalcRequest Request, CalcResult Result);
