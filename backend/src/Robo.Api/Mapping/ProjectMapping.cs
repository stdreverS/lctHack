using Robo.Api.Contracts;
using Robo.Api.Data.Entities;
using Robo.Core.Contracts;

namespace Robo.Api.Mapping;

public static class ProjectMapping
{
    /// <summary>Project из контракта: без владельца.</summary>
    public static ProjectResponse ToResponse(this Project p) =>
        new(p.Id, p.Name, p.ObjectType, p.Params, p.Assumptions, p.CreatedAt, p.UpdatedAt);

    /// <summary>Наименьший срок окупаемости среди сценариев расчёта; null — ни один не окупается.</summary>
    public static decimal? BestPaybackYears(this CalcResult result) =>
        result.Scenarios.Select(s => s.Metrics.PaybackYears.Value).Where(v => v != null).Min();
}
