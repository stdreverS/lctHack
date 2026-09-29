using Robo.Api.Data.Entities;
using Robo.Core.Contracts;

namespace Robo.Api.Mapping;

public static class RobotMapping
{
    /// <summary>Робот каталога → вход расчётного ядра: характеристики на верхнем уровне, null остаётся null.</summary>
    public static RobotSpec ToSpec(this Robot r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        SolutionType = r.SolutionType,
        ObjectTypes = r.ObjectTypes,
        Availability = r.Availability,
        Confirmed = r.Confirmed,
        Price = r.Price,
        RaasMonthlyPrice = r.RaasMonthlyPrice,
        MaintenancePerYear = r.MaintenancePerYear,
        PayloadKg = r.Specs.PayloadKg,
        SpeedMps = r.Specs.SpeedMps,
        PerfOpsPerHour = r.Specs.PerfOpsPerHour,
        AutonomyH = r.Specs.AutonomyH,
        ChargeTimeH = r.Specs.ChargeTimeH,
        PositioningMm = r.Specs.PositioningMm,
        Navigation = r.Specs.Navigation,
        MinAisleM = r.Specs.MinAisleM,
        WidthM = r.Specs.WidthM,
        LengthM = r.Specs.LengthM,
        HeightM = r.Specs.HeightM,
        LifeYears = r.Specs.LifeYears,
    };
}
