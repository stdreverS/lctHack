using Robo.Core.Config;

namespace Robo.Core.Economics;

/// <summary>
/// Коэффициенты модели из backend/config/norms.json (п. 3.5.1 ТЗ: у каждого — источник и статус
/// подтверждения в файле). В коде коэффициентов нет — только ключи.
/// </summary>
internal sealed record ModelNorms(
    double ChargerPriceRub,
    double RobotsPerCharger,
    double IntegrationRub,
    double CommissioningRub,
    double SoftwarePerYearRub,
    double RobotPowerKw,
    double EnergyTariffRub,
    double RaasSetupRub,
    double MaxFleet,
    double PeakFactor,
    double DefaultTargetPerHour,
    double DefaultStaffCount,
    double DefaultStaffCostMonthRub,
    double DefaultWorkHoursPerDay,
    double PaybackGoodYears,
    double PaybackModerateYears)
{
    public static ModelNorms From(NormsConfig n) => new(
        ChargerPriceRub: n.Get("chargerPriceRub"),
        RobotsPerCharger: n.Get("robotsPerCharger"),
        IntegrationRub: n.Get("integrationRub"),
        CommissioningRub: n.Get("commissioningRub"),
        SoftwarePerYearRub: n.Get("softwarePerYearRub"),
        RobotPowerKw: n.Get("robotPowerKw"),
        EnergyTariffRub: n.Get("energyTariffRub"),
        RaasSetupRub: n.Get("raasSetupRub"),
        MaxFleet: n.Get("maxFleet"),
        PeakFactor: n.Get("peakFactor"),
        DefaultTargetPerHour: n.Get("defaultTargetPerHour"),
        DefaultStaffCount: n.Get("defaultStaffCount"),
        DefaultStaffCostMonthRub: n.Get("defaultStaffCostMonthRub"),
        DefaultWorkHoursPerDay: n.Get("defaultWorkHoursPerDay"),
        PaybackGoodYears: n.Get("paybackGoodYears"),
        PaybackModerateYears: n.Get("paybackModerateYears"));
}
