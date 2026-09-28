// Упрощённая экономическая модель мок-сервера. Нужна только для того, чтобы демо-числа
// были согласованы между собой и реагировали на параметры. Настоящий расчёт — на бэкенде.
import type { Assumptions, Params, Robot } from '@/types/api'

export const MOCK_CONST = {
  chargerPriceRub: 350_000,
  robotsPerCharger: 3,
  integrationRub: 3_500_000,
  commissioningRub: 1_800_000,
  softwarePerYearRub: 600_000,
  robotPowerKw: 0.6,
  energyTariffRub: 7,
  raasSetupRub: 1_500_000,
  maxFleet: 40,
  /** Пиковый час относительно среднего часа смены. */
  peakFactor: 1.3,
}

export interface ModelInputs {
  targetPerHour: number
  staffCount: number
  staffCostMonthRub: number
  assumptions: Assumptions
}

function num(params: Params, key: string): number | null {
  const v = params[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Пиковая нагрузка, опер./ч: из суточных объёмов × пиковый коэффициент, но не ниже заданной производительности. */
function peakPerHour(params: Params, workHours: number): number {
  const daily = ['inboundPerDay', 'internalPerDay', 'outboundPerDay', 'deliveriesPerDay']
    .map((key) => num(params, key))
    .filter((v): v is number => v !== null)
  const fromDaily = daily.length ? (daily.reduce((s, v) => s + v, 0) / workHours) * MOCK_CONST.peakFactor : null
  const explicit = num(params, 'processPerfPerHour') ?? num(params, 'bagsPerHourPeak')
  if (explicit !== null && fromDaily !== null) return Math.max(explicit, fromDaily)
  return explicit ?? fromDaily ?? 100
}

export function readInputs(params: Params, a: Assumptions): ModelInputs {
  const workHours = a.shiftsPerDay * a.hoursPerShift || 16
  return {
    targetPerHour: peakPerHour(params, workHours),
    staffCount: num(params, 'staffCount') ?? 20,
    staffCostMonthRub: num(params, 'staffCostMonthRub') ?? 80_000,
    assumptions: a,
  }
}

export function requiredPayloadKg(params: Params): number | null {
  return num(params, 'unitWeightKg') ?? num(params, 'loadKg')
}

export function availableAisleM(params: Params): number | null {
  return num(params, 'aisleWidthM') ?? num(params, 'corridorWidthM')
}

export function hoursPerYear(a: Assumptions): number {
  return a.workDaysPerYear * a.shiftsPerDay * a.hoursPerShift
}

/**
 * Роботов для целевой производительности, с резервом. perfOverride — ручная
 * производительность (overrides.perfOpsPerHour). null — данных о производительности нет.
 */
export function fleetSize(
  targetPerHour: number,
  robot: Robot,
  a: Assumptions,
  perfOverride: number | null = null,
): number | null {
  const perf = perfOverride ?? robot.specs.perfOpsPerHour
  if (!perf) return null
  const base = Math.ceil(targetPerHour / (perf * a.utilization * a.availability))
  return Math.max(1, Math.ceil(base * (1 + a.reserveShare)))
}

export interface Economics {
  robotCount: number
  capexRub: number
  laborBaseRub: number
  laborSavingRub: number
  replacedStaff: number
  robotOpexRub: number
  opexAnnualRub: number
  opexDeltaRub: number
  annualEffectRub: number
  paybackYears: number | null
  roiPercent: number | null
  tcoRub: number
}

export function economics(
  inputs: ModelInputs,
  robotCount: number,
  capexRub: number,
  robotOpexRub: number,
  /** Доля пиковой нагрузки, которую закрывает парк (1 — полностью); меньше роботов — меньше замещённого персонала. */
  coverage = 1,
): Economics {
  const { assumptions: a } = inputs
  const laborBaseRub = Math.round(inputs.staffCount * inputs.staffCostMonthRub * 12)
  const replacedStaff =
    robotCount > 0 ? Math.floor(inputs.staffCount * a.staffReplacedShare * Math.min(1, Math.max(0, coverage))) : 0
  const laborSavingRub = Math.round(replacedStaff * inputs.staffCostMonthRub * 12)
  const opexAnnualRub = laborBaseRub - laborSavingRub + robotOpexRub
  const opexDeltaRub = opexAnnualRub - laborBaseRub
  const annualEffectRub = -opexDeltaRub
  const paybackYears =
    robotCount > 0 && annualEffectRub > 0 ? Math.round((capexRub / annualEffectRub) * 100) / 100 : null
  const roiPercent =
    capexRub > 0
      ? Math.round(((annualEffectRub * a.horizonYears - capexRub) / capexRub) * 1000) / 10
      : null
  return {
    robotCount,
    capexRub,
    laborBaseRub,
    laborSavingRub,
    replacedStaff,
    robotOpexRub,
    opexAnnualRub,
    opexDeltaRub,
    annualEffectRub,
    paybackYears,
    roiPercent,
    tcoRub: capexRub + opexAnnualRub * a.horizonYears,
  }
}

export function energyRub(robotCount: number, a: Assumptions): number {
  return Math.round(robotCount * MOCK_CONST.robotPowerKw * hoursPerYear(a) * MOCK_CONST.energyTariffRub)
}

export function chargers(robotCount: number): number {
  return Math.ceil(robotCount / MOCK_CONST.robotsPerCharger)
}

export function purchaseCapex(robotCount: number, unitPriceRub: number): number {
  return (
    robotCount * unitPriceRub +
    chargers(robotCount) * MOCK_CONST.chargerPriceRub +
    MOCK_CONST.integrationRub +
    MOCK_CONST.commissioningRub
  )
}

export function purchaseRobotOpex(
  robotCount: number,
  robot: Robot,
  a: Assumptions,
  /** Обслуживание одного робота в год (overrides.maintenancePerYearRub). */
  maintenanceOverride: number | null = null,
): number {
  const maintenance = maintenanceOverride ?? robot.maintenancePerYear
  return robotCount * maintenance + energyRub(robotCount, a) + MOCK_CONST.softwarePerYearRub
}

export function raasRobotOpex(robotCount: number, monthlyFeeRub: number, a: Assumptions): number {
  return robotCount * monthlyFeeRub * 12 + energyRub(robotCount, a)
}
