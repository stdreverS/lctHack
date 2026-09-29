using Robo.Core.Config;
using Robo.Core.Contracts;
using Robo.Core.Internal;

namespace Robo.Core.Economics;

/// <summary>
/// Таблица assumptionsUsed: допущения проекта и ключевые коэффициенты с источником и статусом.
/// Подписи, единицы и источники — из norms.json; значения допущений — из запроса.
/// Доли показываются в процентах (0,85 → 85 %), как ожидает экран.
/// </summary>
internal static class AssumptionsReport
{
    public static IReadOnlyList<AssumptionRef> Build(ModelInputs inputs, NormsConfig norms)
    {
        var a = inputs.Assumptions;
        return
        [
            FromNorm(norms, "horizonYears", a.HorizonYears),
            FromNorm(norms, "workDaysPerYear", a.WorkDaysPerYear),
            FromNorm(norms, "shiftsPerDay", a.ShiftsPerDay),
            FromNorm(norms, "hoursPerShift", a.HoursPerShift),
            FromNorm(norms, "utilization", a.Utilization),
            FromNorm(norms, "availability", a.Availability),
            FromNorm(norms, "reserveShare", a.ReserveShare),
            FromNorm(norms, "staffReplacedShare", a.StaffReplacedShare),
            // Параметр объекта, а не норматив
            new("staffCostMonthRub", "Стоимость сотрудника", Js.Round(inputs.StaffCostMonthRub), "₽/мес", "Параметры объекта", true),
            FromNorm(norms, "energyTariffRub"),
            FromNorm(norms, "integrationRub"),
        ];
    }

    private static AssumptionRef FromNorm(NormsConfig norms, string key, double? value = null)
    {
        var norm = norms.Find(key) ?? throw new KeyNotFoundException($"В norms.json нет норматива «{key}»");
        var v = value ?? norm.Value;
        return norm.Unit == "доля"
            ? new AssumptionRef(key, norm.Label, Js.Round(v * 1000) / 10, "%", norm.Source, norm.Confirmed)
            : new AssumptionRef(key, norm.Label, v, norm.Unit, norm.Source, norm.Confirmed);
    }
}
