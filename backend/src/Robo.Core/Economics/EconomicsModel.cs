using System.Text.Json;
using Robo.Core.Contracts;
using Robo.Core.Internal;

namespace Robo.Core.Economics;

/// <summary>Входы модели после разбора параметров объекта (docs/economics.md, «Входные данные»).</summary>
internal sealed record ModelInputs(double TargetPerHour, double StaffCount, double StaffCostMonthRub, Assumptions Assumptions);

/// <summary>Показатели сценария до оформления в Metric.</summary>
internal sealed record EconomicsValues(
    int RobotCount,
    double CapexRub,
    double LaborBaseRub,
    double LaborSavingRub,
    double ReplacedStaff,
    double RobotOpexRub,
    double OpexAnnualRub,
    double OpexDeltaRub,
    double AnnualEffectRub,
    double? PaybackYears,
    double? RoiPercent,
    double TcoRub);

/// <summary>
/// Формулы экономической модели econ-1.0 (docs/economics.md, формулы 1–12). Перенесены из
/// frontend/src/mocks/data/model.ts без изменений; коэффициенты — из norms.json.
/// </summary>
internal sealed class EconomicsModel(ModelNorms norms)
{
    public const string Version = "econ-1.0";

    private static readonly string[] DailyVolumeKeys = ["inboundPerDay", "internalPerDay", "outboundPerDay", "deliveriesPerDay"];

    public ModelNorms Norms => norms;

    /// <summary>Числовой параметр объекта; строка, bool, null или отсутствие — null.</summary>
    public static double? Num(IReadOnlyDictionary<string, JsonElement> p, string key) =>
        p.TryGetValue(key, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;

    public static double? RequiredPayloadKg(IReadOnlyDictionary<string, JsonElement> p) =>
        Num(p, "unitWeightKg") ?? Num(p, "loadKg");

    public static double? AvailableAisleM(IReadOnlyDictionary<string, JsonElement> p) =>
        Num(p, "aisleWidthM") ?? Num(p, "corridorWidthM");

    /// <summary>Формула 1: пиковая потребность, опер./ч.</summary>
    private double PeakPerHour(IReadOnlyDictionary<string, JsonElement> p, double workHours)
    {
        double? fromDaily = null;
        var daily = DailyVolumeKeys.Select(k => Num(p, k)).Where(v => v != null).Select(v => v!.Value).ToList();
        if (daily.Count > 0)
        {
            var sum = 0.0;
            foreach (var v in daily) sum += v;
            fromDaily = sum / workHours * norms.PeakFactor;
        }
        var explicitPerHour = Num(p, "processPerfPerHour") ?? Num(p, "bagsPerHourPeak");
        if (explicitPerHour != null && fromDaily != null) return Math.Max(explicitPerHour.Value, fromDaily.Value);
        return explicitPerHour ?? fromDaily ?? norms.DefaultTargetPerHour;
    }

    public ModelInputs ReadInputs(IReadOnlyDictionary<string, JsonElement> p, Assumptions a)
    {
        var workHours = a.ShiftsPerDay * a.HoursPerShift;
        if (workHours == 0 || double.IsNaN(workHours)) workHours = norms.DefaultWorkHoursPerDay;
        return new ModelInputs(
            PeakPerHour(p, workHours),
            Num(p, "staffCount") ?? norms.DefaultStaffCount,
            Num(p, "staffCostMonthRub") ?? norms.DefaultStaffCostMonthRub,
            a);
    }

    public static double HoursPerYear(Assumptions a) => a.WorkDaysPerYear * a.ShiftsPerDay * a.HoursPerShift;

    /// <summary>
    /// Формула 2: роботов для целевой производительности с резервом. perfOverride —
    /// overrides.perfOpsPerHour. null — производительность неизвестна.
    /// </summary>
    public static int? FleetSize(double targetPerHour, RobotSpec robot, Assumptions a, double? perfOverride = null)
    {
        var perf = perfOverride ?? robot.PerfOpsPerHour;
        if (perf is not { } p || p == 0 || double.IsNaN(p)) return null;
        var baseCount = Math.Ceiling(targetPerHour / (p * a.Utilization * a.Availability));
        return (int)Math.Max(1, Math.Ceiling(baseCount * (1 + a.ReserveShare)));
    }

    /// <summary>Формулы 8–12. coverage — доля пиковой нагрузки, которую закрывает парк.</summary>
    public static EconomicsValues Calculate(ModelInputs inputs, int robotCount, double capexRub, double robotOpexRub, double coverage = 1)
    {
        var a = inputs.Assumptions;
        var laborBaseRub = Js.Round(inputs.StaffCount * inputs.StaffCostMonthRub * 12);
        var replacedStaff = robotCount > 0
            ? Math.Floor(inputs.StaffCount * a.StaffReplacedShare * Math.Min(1, Math.Max(0, coverage)))
            : 0;
        var laborSavingRub = Js.Round(replacedStaff * inputs.StaffCostMonthRub * 12);
        var opexAnnualRub = laborBaseRub - laborSavingRub + robotOpexRub;
        var opexDeltaRub = opexAnnualRub - laborBaseRub;
        var annualEffectRub = -opexDeltaRub;
        double? paybackYears = robotCount > 0 && annualEffectRub > 0
            ? Js.Round(capexRub / annualEffectRub * 100) / 100
            : null;
        // ROI по п. 3.5.2 ТЗ: накопленный эффект за горизонт / CAPEX × 100 %
        double? roiPercent = capexRub > 0
            ? Js.Round(annualEffectRub * a.HorizonYears / capexRub * 1000) / 10
            : null;
        return new EconomicsValues(
            robotCount, capexRub, laborBaseRub, laborSavingRub, replacedStaff, robotOpexRub,
            opexAnnualRub, opexDeltaRub, annualEffectRub, paybackYears, roiPercent,
            capexRub + opexAnnualRub * a.HorizonYears);
    }

    /// <summary>Формула 6: электроэнергия, ₽/год.</summary>
    public double EnergyRub(int robotCount, Assumptions a) =>
        Js.Round(robotCount * norms.RobotPowerKw * HoursPerYear(a) * norms.EnergyTariffRub);

    /// <summary>Формула 3: зарядные станции.</summary>
    public int Chargers(int robotCount) => (int)Math.Ceiling(robotCount / norms.RobotsPerCharger);

    /// <summary>Формула 4: CAPEX покупки.</summary>
    public double PurchaseCapex(int robotCount, double unitPriceRub) =>
        robotCount * unitPriceRub + Chargers(robotCount) * norms.ChargerPriceRub + norms.IntegrationRub + norms.CommissioningRub;

    /// <summary>Формула 7, покупка: обслуживание + энергия + ПО.</summary>
    public double PurchaseRobotOpex(int robotCount, RobotSpec robot, Assumptions a, double? maintenanceOverride = null) =>
        robotCount * (maintenanceOverride ?? (double)robot.MaintenancePerYear) + EnergyRub(robotCount, a) + norms.SoftwarePerYearRub;

    /// <summary>Формула 7, RaaS: плата за аренду + энергия.</summary>
    public double RaasRobotOpex(int robotCount, double monthlyFeeRub, Assumptions a) =>
        robotCount * monthlyFeeRub * 12 + EnergyRub(robotCount, a);
}
