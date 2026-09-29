// Шаг «What-if»: значения панели допущений, сборка запроса и сравнение результатов.
// Экономику считает сервер — здесь только подготовка запроса и разбор ответа.
import type {
  Assumptions,
  MetricKey,
  Params,
  Robot,
  ScenarioInput,
  ScenarioResult,
  SensParam,
  SensitivityPoint,
  SensitivitySeries,
} from '@/types/api'

/** Значения, которыми крутят расчёт на шаге «What-if». */
export interface WhatIfValues {
  staffCostMonthRub: number
  shiftsPerDay: number
  hoursPerShift: number
  workDaysPerYear: number
  /** Доля, 0–1. В интерфейсе показывается в процентах. */
  utilization: number
  horizonYears: number
  perfOpsPerHour: number
  unitPriceRub: number
  maintenancePerYearRub: number
}

export type WhatIfKey = keyof WhatIfValues

/** Подстановки, если данных нет ни в параметрах объекта, ни в каталоге. */
export const WHATIF_FALLBACK = {
  staffCostMonthRub: 80_000,
  perfOpsPerHour: 20,
  unitPriceRub: 5_000_000,
  maintenancePerYearRub: 300_000,
} as const

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Исходные значения панели: из параметров объекта, допущений проекта и каталога робота.
 * Ручные правки сценария «покупка» (шаг «Экономика») важнее каталога: иначе рядом с полем
 * стояло бы одно исходное значение, а расчёт шёл бы по другому.
 */
export function whatIfBase(
  params: Params,
  a: Assumptions,
  robot: Robot | null,
  overrides?: ScenarioInput['overrides'],
): WhatIfValues {
  return {
    staffCostMonthRub: positive(params.staffCostMonthRub, WHATIF_FALLBACK.staffCostMonthRub),
    shiftsPerDay: a.shiftsPerDay,
    hoursPerShift: a.hoursPerShift,
    workDaysPerYear: a.workDaysPerYear,
    utilization: a.utilization,
    // Горизонт на этом шаге — от 5 до 10 лет (п. 3.5.3 ТЗ).
    horizonYears: Math.min(10, Math.max(5, a.horizonYears)),
    perfOpsPerHour: positive(
      overrides?.perfOpsPerHour ?? robot?.specs.perfOpsPerHour,
      WHATIF_FALLBACK.perfOpsPerHour,
    ),
    unitPriceRub: positive(overrides?.unitPriceRub ?? robot?.price, WHATIF_FALLBACK.unitPriceRub),
    maintenancePerYearRub: positive(
      overrides?.maintenancePerYearRub ?? robot?.maintenancePerYear,
      WHATIF_FALLBACK.maintenancePerYearRub,
    ),
  }
}

export interface WhatIfRequestParts {
  params: Params
  assumptions: Assumptions
  scenarios: ScenarioInput[]
}

/**
 * Подставляет значения панели в параметры, допущения и сценарии.
 * Поля робота уходят в overrides, только если их изменили: иначе остаётся то, что было
 * в сценарии (или null — значение берётся из каталога и считается сервером).
 * Цена и обслуживание относятся к покупке, производительность — к обоим сценариям с роботами.
 */
export function applyWhatIf(
  base: WhatIfRequestParts,
  values: WhatIfValues,
  baseValues: WhatIfValues,
): WhatIfRequestParts {
  const changed = (key: WhatIfKey) => values[key] !== baseValues[key]
  return {
    params: { ...base.params, staffCostMonthRub: values.staffCostMonthRub },
    assumptions: {
      ...base.assumptions,
      shiftsPerDay: values.shiftsPerDay,
      hoursPerShift: values.hoursPerShift,
      workDaysPerYear: values.workDaysPerYear,
      utilization: values.utilization,
      horizonYears: values.horizonYears,
    },
    scenarios: base.scenarios.map((s) => {
      if (s.kind === 'baseline') return s
      // Поле не трогали — остаётся ручная правка сценария (или null: считает сервер).
      const kept = (key: 'perfOpsPerHour' | 'unitPriceRub' | 'maintenancePerYearRub') =>
        changed(key) ? values[key] : (s.overrides?.[key] ?? null)
      const overrides = {
        ...s.overrides,
        perfOpsPerHour: kept('perfOpsPerHour'),
        ...(s.kind === 'purchase'
          ? {
              unitPriceRub: kept('unitPriceRub'),
              maintenancePerYearRub: kept('maintenancePerYearRub'),
            }
          : {}),
      }
      return { ...s, overrides }
    }),
  }
}

// ---------- Таблица сравнения сценариев ----------

/** В какую сторону значение показателя лучше. */
const BETTER: Record<MetricKey, 'lower' | 'higher'> = {
  robotCount: 'lower',
  capexRub: 'lower',
  opexAnnualRub: 'lower',
  opexDeltaRub: 'lower',
  annualEffectRub: 'higher',
  paybackYears: 'lower',
  roiPercent: 'higher',
  tcoRub: 'lower',
}

export const COMPARE_ROWS: MetricKey[] = [
  'robotCount', 'capexRub', 'opexAnnualRub', 'opexDeltaRub',
  'annualEffectRub', 'paybackYears', 'roiPercent', 'tcoRub',
]

export interface CompareCell {
  scenarioId: string
  value: number | null
  /** Значение лучше, чем у других сценариев с роботами. */
  best: boolean
  /** Разница с предыдущим расчётом; null — сравнивать не с чем. */
  delta: number | null
  /** Стало лучше (true), хуже (false) или разницы нет (null). */
  improved: boolean | null
  overridden: boolean
}

export interface CompareRow {
  key: MetricKey
  label: string
  unit: string
  cells: CompareCell[]
}

/**
 * Одна таблица: строки — показатели, столбцы — сценарии.
 * «Лучшее» ищется только среди сценариев с роботами: у текущего состояния нет ни
 * капитальных затрат, ни окупаемости, и сравнивать его по ним не с чем.
 */
export function compareScenarios(
  scenarios: readonly ScenarioResult[],
  previous?: readonly ScenarioResult[] | null,
): CompareRow[] {
  return COMPARE_ROWS.map((key) => {
    const cells: CompareCell[] = scenarios.map((s) => {
      const metric = s.metrics[key]
      const prev = previous?.find((p) => p.id === s.id)?.metrics[key].value ?? null
      const delta = metric.value !== null && prev !== null && metric.value !== prev ? metric.value - prev : null
      return {
        scenarioId: s.id,
        value: metric.value,
        best: false,
        delta,
        improved: delta === null ? null : BETTER[key] === 'lower' ? delta < 0 : delta > 0,
        overridden: metric.overridden,
      }
    })

    const candidates = cells.filter((c, i) => scenarios[i]!.kind !== 'baseline' && c.value !== null)
    if (candidates.length > 1) {
      const values = candidates.map((c) => c.value!)
      const bestValue = BETTER[key] === 'lower' ? Math.min(...values) : Math.max(...values)
      for (const c of candidates) if (c.value === bestValue) c.best = true
    }

    const sample = scenarios[0]?.metrics[key]
    return { key, label: sample?.label ?? key, unit: sample?.unit ?? '', cells }
  })
}

// ---------- Чувствительность ----------

export const SENS_PARAMS: SensParam[] = ['equipmentPrice', 'operationsVolume', 'laborCost']

export const SENS_LABELS: Record<SensParam, string> = {
  equipmentPrice: 'Стоимость оборудования',
  operationsVolume: 'Объём операций',
  laborCost: 'Стоимость труда',
}

export const SENS_DELTAS = [-0.2, -0.1, 0.1, 0.2]

/**
 * Точки ряда вместе с «0 %» — текущим сроком окупаемости сценария,
 * чтобы на графике было видно, от какого значения идёт отклонение.
 */
export function pointsWithZero(
  points: readonly SensitivityPoint[],
  currentPaybackYears: number | null,
): { delta: number; paybackYears: number | null }[] {
  const list = points.map((p) => ({ delta: p.delta, paybackYears: p.paybackYears }))
  if (!list.some((p) => p.delta === 0)) list.push({ delta: 0, paybackYears: currentPaybackYears })
  return list.sort((a, b) => a.delta - b.delta)
}

/**
 * Параметр, от которого окупаемость зависит сильнее всего: наибольший разброс
 * срока окупаемости между крайними отклонениями. null — сравнивать нечего.
 */
export function strongestParam(series: readonly SensitivitySeries[]): { param: SensParam; label: string; spreadYears: number } | null {
  let best: { param: SensParam; label: string; spreadYears: number } | null = null
  for (const s of series) {
    const values = s.points.map((p) => p.paybackYears).filter((v): v is number => v !== null)
    if (values.length < 2) continue
    const spread = Math.max(...values) - Math.min(...values)
    if (!best || spread > best.spreadYears) best = { param: s.param, label: s.label, spreadYears: spread }
  }
  return best
}
