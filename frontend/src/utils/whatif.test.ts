import { describe, expect, it } from 'vitest'
import type { Assumptions, Metric, MetricKey, Robot, ScenarioInput, ScenarioResult, SensitivitySeries } from '@/types/api'
import { DEFAULT_ASSUMPTIONS } from './projects'
import { applyWhatIf, compareScenarios, pointsWithZero, strongestParam, whatIfBase, WHATIF_FALLBACK } from './whatif'

const robot: Robot = {
  id: 'r1', name: 'Робот', manufacturer: 'Завод', solutionType: 'amr', solutionTypeName: 'AMR',
  objectTypes: ['warehouse'], country: null, availability: null,
  price: 4_200_000, raasMonthlyPrice: 115_000, maintenancePerYear: 320_000,
  specs: { perfOpsPerHour: 45 }, sourceUrl: null, sourceDate: null, confirmed: true,
}

const assumptions: Assumptions = { ...DEFAULT_ASSUMPTIONS }

function metric(value: number | null, overridden = false): Metric {
  return { label: 'Показатель', value, unit: '₽', formula: '', overridden }
}

function scenario(id: string, kind: ScenarioResult['kind'], values: Partial<Record<MetricKey, number | null>>): ScenarioResult {
  const keys: MetricKey[] = ['robotCount', 'capexRub', 'opexAnnualRub', 'opexDeltaRub', 'annualEffectRub', 'paybackYears', 'roiPercent', 'tcoRub']
  const metrics = Object.fromEntries(keys.map((k) => [k, metric(values[k] ?? null)])) as Record<MetricKey, Metric>
  return { id, kind, title: id, robotId: null, equipment: [], metrics, cashflow: [], verdict: { level: 'good', label: '', interpretation: '', risks: [] } }
}

describe('whatIfBase', () => {
  it('берёт значения из параметров, допущений и каталога', () => {
    const base = whatIfBase({ staffCostMonthRub: 95_000 }, assumptions, robot)
    expect(base.staffCostMonthRub).toBe(95_000)
    expect(base.perfOpsPerHour).toBe(45)
    expect(base.unitPriceRub).toBe(4_200_000)
    expect(base.maintenancePerYearRub).toBe(320_000)
    expect(base.utilization).toBe(assumptions.utilization)
  })
  it('ручные правки сценария важнее каталога', () => {
    const base = whatIfBase({}, assumptions, robot, {
      unitPriceRub: 3_900_000,
      maintenancePerYearRub: 410_000,
      perfOpsPerHour: null,
    })
    expect(base.unitPriceRub).toBe(3_900_000)
    expect(base.maintenancePerYearRub).toBe(410_000)
    expect(base.perfOpsPerHour).toBe(45)
  })
  it('нет данных — подстановки; горизонт ограничен 5–10 годами', () => {
    const base = whatIfBase({ staffCostMonthRub: null }, { ...assumptions, horizonYears: 3 }, null)
    expect(base.staffCostMonthRub).toBe(WHATIF_FALLBACK.staffCostMonthRub)
    expect(base.perfOpsPerHour).toBe(WHATIF_FALLBACK.perfOpsPerHour)
    expect(base.horizonYears).toBe(5)
    expect(whatIfBase({}, { ...assumptions, horizonYears: 12 }, robot).horizonYears).toBe(10)
  })
})

describe('applyWhatIf', () => {
  const scenarios: ScenarioInput[] = [
    { id: 'baseline', kind: 'baseline', title: 'Текущее', robotId: null },
    { id: 'purchase', kind: 'purchase', title: 'Покупка', robotId: 'r1', overrides: { robotCount: 7 } },
    { id: 'raas', kind: 'raas', title: 'RaaS', robotId: 'r1' },
  ]
  const base = { params: { staffCostMonthRub: 95_000, areaM2: 12_000 }, assumptions, scenarios }
  const values = whatIfBase(base.params, assumptions, robot)

  it('без изменений ручные правки цены и обслуживания сохраняются', () => {
    const withPrice: ScenarioInput[] = [
      { id: 'purchase', kind: 'purchase', title: 'Покупка', robotId: 'r1', overrides: { unitPriceRub: 3_900_000, maintenancePerYearRub: 410_000 } },
    ]
    const b = { params: base.params, assumptions, scenarios: withPrice }
    const v = whatIfBase(b.params, assumptions, robot, withPrice[0]!.overrides)
    const out = applyWhatIf(b, v, v)
    expect(out.scenarios[0]!.overrides).toMatchObject({ unitPriceRub: 3_900_000, maintenancePerYearRub: 410_000 })
    const raised = applyWhatIf(b, { ...v, unitPriceRub: 4_500_000 }, v)
    expect(raised.scenarios[0]!.overrides).toMatchObject({ unitPriceRub: 4_500_000, maintenancePerYearRub: 410_000 })
  })
  it('без изменений overrides робота пустые, ручные правки сохраняются', () => {
    const out = applyWhatIf(base, values, values)
    expect(out.params).toEqual(base.params)
    expect(out.scenarios[0]).toBe(scenarios[0])
    expect(out.scenarios[1]!.overrides).toEqual({
      robotCount: 7, perfOpsPerHour: null, unitPriceRub: null, maintenancePerYearRub: null,
    })
    expect(out.scenarios[2]!.overrides).toEqual({ perfOpsPerHour: null })
  })

  it('изменённые значения уходят в params, assumptions и overrides', () => {
    const out = applyWhatIf(
      base,
      { ...values, staffCostMonthRub: 60_000, utilization: 0.9, horizonYears: 7, perfOpsPerHour: 60, unitPriceRub: 3_000_000, maintenancePerYearRub: 400_000 },
      values,
    )
    expect(out.params.staffCostMonthRub).toBe(60_000)
    expect(out.params.areaM2).toBe(12_000)
    expect(out.assumptions.utilization).toBe(0.9)
    expect(out.assumptions.horizonYears).toBe(7)
    expect(out.scenarios[1]!.overrides).toEqual({
      robotCount: 7, perfOpsPerHour: 60, unitPriceRub: 3_000_000, maintenancePerYearRub: 400_000,
    })
    // У аренды цена покупки и обслуживание не применяются.
    expect(out.scenarios[2]!.overrides).toEqual({ perfOpsPerHour: 60 })
  })
})

describe('compareScenarios', () => {
  const current = [
    scenario('baseline', 'baseline', { capexRub: 0, paybackYears: null }),
    scenario('purchase', 'purchase', { capexRub: 74_600_000, paybackYears: 1.7, roiPercent: 195 }),
    scenario('raas', 'raas', { capexRub: 1_500_000, paybackYears: 2.1, roiPercent: 136 }),
  ]

  it('лучшее значение — среди сценариев с роботами, по направлению показателя', () => {
    const rows = compareScenarios(current)
    const capex = rows.find((r) => r.key === 'capexRub')!
    expect(capex.cells.map((c) => c.best)).toEqual([false, false, true])
    const roi = rows.find((r) => r.key === 'roiPercent')!
    expect(roi.cells.map((c) => c.best)).toEqual([false, true, false])
    const payback = rows.find((r) => r.key === 'paybackYears')!
    expect(payback.cells.map((c) => c.best)).toEqual([false, true, false])
  })

  it('разница с предыдущим расчётом и оценка «лучше/хуже»', () => {
    const previous = [
      scenario('baseline', 'baseline', { capexRub: 0 }),
      scenario('purchase', 'purchase', { capexRub: 80_000_000, paybackYears: 1.5 }),
      scenario('raas', 'raas', { capexRub: 1_500_000, paybackYears: 2.1 }),
    ]
    const rows = compareScenarios(current, previous)
    const capexPurchase = rows.find((r) => r.key === 'capexRub')!.cells[1]!
    expect(capexPurchase.delta).toBe(-5_400_000)
    expect(capexPurchase.improved).toBe(true)
    const paybackPurchase = rows.find((r) => r.key === 'paybackYears')!.cells[1]!
    expect(paybackPurchase.delta).toBeCloseTo(0.2, 5)
    expect(paybackPurchase.improved).toBe(false)
    // Значение не изменилось — стрелки нет.
    expect(rows.find((r) => r.key === 'paybackYears')!.cells[2]!.delta).toBeNull()
  })

  it('без предыдущего расчёта разниц нет, порядок строк фиксированный', () => {
    const rows = compareScenarios(current)
    expect(rows.map((r) => r.key)).toEqual([
      'robotCount', 'capexRub', 'opexAnnualRub', 'opexDeltaRub', 'annualEffectRub', 'paybackYears', 'roiPercent', 'tcoRub',
    ])
    expect(rows.every((r) => r.cells.every((c) => c.delta === null))).toBe(true)
  })
})

describe('strongestParam', () => {
  const series = (param: SensitivitySeries['param'], values: (number | null)[]): SensitivitySeries => ({
    scenarioId: 'purchase', param, label: param,
    points: values.map((paybackYears, i) => ({ delta: [-0.2, -0.1, 0.1, 0.2][i]!, paybackYears, roiPercent: null, annualEffectRub: 0 })),
  })

  it('наибольший разброс окупаемости', () => {
    const result = strongestParam([
      series('equipmentPrice', [1.4, 1.6, 1.8, 2.0]),
      series('laborCost', [3.0, 2.2, 1.5, 1.2]),
    ])
    expect(result?.param).toBe('laborCost')
    expect(result?.spreadYears).toBeCloseTo(1.8, 5)
  })
  it('рядов нет или точек мало — null', () => {
    expect(strongestParam([])).toBeNull()
    expect(strongestParam([series('equipmentPrice', [null, null, null, 2])])).toBeNull()
  })
})

describe('pointsWithZero', () => {
  const points = [-0.2, 0.2].map((delta) => ({ delta, paybackYears: 2, roiPercent: null, annualEffectRub: 0 }))

  it('добавляет точку «без отклонения» и сортирует по отклонению', () => {
    expect(pointsWithZero(points, 1.7)).toEqual([
      { delta: -0.2, paybackYears: 2 },
      { delta: 0, paybackYears: 1.7 },
      { delta: 0.2, paybackYears: 2 },
    ])
  })
  it('если сервер уже прислал 0 %, точка не дублируется', () => {
    const withZero = [...points, { delta: 0, paybackYears: 1.5, roiPercent: null, annualEffectRub: 0 }]
    expect(pointsWithZero(withZero, 9).filter((p) => p.delta === 0)).toEqual([{ delta: 0, paybackYears: 1.5 }])
  })
})
