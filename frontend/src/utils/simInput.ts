// Сборка входных данных симуляции из состояния мастера: сценарий расчёта, каталог робота,
// параметры объекта и план. Сама модель — src/sim/engine.ts.
import type { Assumptions, Layout, Params, Robot, ScenarioResult } from '@/types/api'
import type { SimInput } from '@/types/sim'

/** Подстановки, если данных нет ни в каталоге, ни в параметрах объекта. */
export const SIM_FALLBACK = {
  speedMps: 1.2,
  autonomyH: 8,
  chargeTimeH: 2,
  peakOpsPerHour: 100,
  avgRouteM: 100,
} as const

/** Симулируется пиковый час: KPI сравнивается с целевой производительностью в пиковый час. */
export const SIM_HOURS = 1

/** Зерно фиксировано: одна и та же конфигурация всегда даёт один и тот же прогон. */
export const SIM_SEED = 20260922

/** Суточные объёмы, из которых оценивается поток, если сервер не прислал целевое значение. */
const DAILY_KEYS = ['inboundPerDay', 'internalPerDay', 'outboundPerDay', 'deliveriesPerDay']

export interface SimInputBuild {
  input: SimInput
  /** Число роботов сценария — показывается в вердикте. */
  robotCount: number
  /** Что подставлено вместо отсутствующих данных; показывается пользователю. */
  notes: string[]
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Целевая производительность, опер./ч. Сначала — значение сервера из metrics.robotCount.inputs
 * (тогда симуляция проверяет ровно тот поток, по которому считался парк), иначе оценка
 * по параметрам объекта.
 */
export function targetPerHour(
  scenario: ScenarioResult,
  params: Params,
  assumptions: Assumptions,
): { value: number; note: string | null } {
  const fromServer = positive(scenario.metrics.robotCount.inputs?.targetPerHour)
  if (fromServer !== null) return { value: fromServer, note: null }

  const explicit = positive(params.processPerfPerHour) ?? positive(params.bagsPerHourPeak)
  if (explicit !== null) {
    return { value: explicit, note: null }
  }

  const daily = DAILY_KEYS.map((key) => positive(params[key])).filter((v): v is number => v !== null)
  const workHours = assumptions.shiftsPerDay * assumptions.hoursPerShift || 16
  if (daily.length) {
    const value = daily.reduce((sum, v) => sum + v, 0) / workHours
    return { value, note: `Целевая производительность оценена по суточным объёмам: ${Math.round(value)} опер./ч` }
  }
  return {
    value: SIM_FALLBACK.peakOpsPerHour,
    note: `Целевая производительность не задана — принято ${SIM_FALLBACK.peakOpsPerHour} опер./ч`,
  }
}

/** Средняя длина маршрута, м: из параметров объекта, иначе — половина стороны плана. */
export function avgRouteM(params: Params, layout: Layout): { value: number; note: string | null } {
  const fromParams = positive(params.avgRouteM) ?? positive(params.bagTransferM)
  if (fromParams !== null) return { value: fromParams, note: null }
  const guess = Math.round(((layout.widthM || 0) + (layout.heightM || 0)) / 2) || SIM_FALLBACK.avgRouteM
  return { value: guess, note: `Средняя длина маршрута не задана — принято ${guess} м по размеру плана` }
}

/**
 * Вход движка для одного сценария. Число роботов берётся из расчёта сервера,
 * характеристики — из каталога, поток и длина маршрута — из параметров объекта.
 */
export function buildSimInput(args: {
  layout: Layout
  params: Params
  assumptions: Assumptions
  scenario: ScenarioResult
  robot: Robot | null
  seed?: number
}): SimInputBuild {
  const { layout, params, assumptions, scenario, robot } = args
  const notes: string[] = []
  const robotCount = Math.max(0, Math.round(scenario.metrics.robotCount.value ?? 0))

  const speed = positive(robot?.specs.speedMps)
  if (speed === null) notes.push(`Скорость робота не указана в каталоге — принято ${SIM_FALLBACK.speedMps} м/с`)
  const autonomy = positive(robot?.specs.autonomyH)
  if (autonomy === null) notes.push(`Автономность не указана в каталоге — принято ${SIM_FALLBACK.autonomyH} ч`)
  const perf = positive(robot?.specs.perfOpsPerHour)
  if (perf === null) notes.push('Производительность робота не указана в каталоге — время заявки считается по скорости и длине маршрута')
  const charge = positive(robot?.specs.chargeTimeH)
  if (charge === null) notes.push(`Время зарядки не указано в каталоге — принято ${SIM_FALLBACK.chargeTimeH} ч`)

  const target = targetPerHour(scenario, params, assumptions)
  if (target.note) notes.push(target.note)
  const route = avgRouteM(params, layout)
  if (route.note) notes.push(route.note)

  return {
    robotCount,
    notes,
    input: {
      seed: args.seed ?? SIM_SEED,
      simHours: SIM_HOURS,
      layout,
      demand: { peakOpsPerHour: target.value, avgRouteM: route.value },
      robots: {
        count: robotCount,
        speedMps: speed ?? SIM_FALLBACK.speedMps,
        ...(perf !== null ? { opsPerHour: perf } : {}),
        autonomyH: autonomy ?? SIM_FALLBACK.autonomyH,
        chargeTimeH: charge ?? SIM_FALLBACK.chargeTimeH,
      },
    },
  }
}
