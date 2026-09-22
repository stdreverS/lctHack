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
  raasSetupRub: 4_000_000,
  maxFleet: 40,
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

export function readInputs(params: Params, a: Assumptions): ModelInputs {
  const perShiftHours = a.shiftsPerDay * a.hoursPerShift || 16
  const deliveries = num(params, 'deliveriesPerDay')
  return {
    targetPerHour:
      num(params, 'processPerfPerHour') ??
      num(params, 'bagsPerHourPeak') ??
      (deliveries !== null ? deliveries / perShiftHours : 100),
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

/** Роботов для целевой производительности, с резервом. null — нет данных о производительности. */
export function fleetSize(targetPerHour: number, robot: Robot, a: Assumptions): number | null {
  const perf = robot.specs.perfOpsPerHour
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
): Economics {
  const { assumptions: a } = inputs
  const laborBaseRub = Math.round(inputs.staffCount * inputs.staffCostMonthRub * 12)
  const replacedStaff = robotCount > 0 ? Math.floor(inputs.staffCount * a.staffReplacedShare) : 0
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

export function purchaseRobotOpex(robotCount: number, robot: Robot, a: Assumptions): number {
  return robotCount * robot.maintenancePerYear + energyRub(robotCount, a) + MOCK_CONST.softwarePerYearRub
}

export function raasRobotOpex(robotCount: number, monthlyFeeRub: number, a: Assumptions): number {
  return robotCount * monthlyFeeRub * 12 + energyRub(robotCount, a)
}
