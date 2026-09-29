import { describe, expect, it } from 'vitest'
import type { ParamField, ScenarioResult, SensitivitySeries, SimKpi } from '@/types/api'
import { defaultAssumptions, objectTypes } from '@/mocks/data/objectTypes'
import { deltaLabel, formatParamValue, paramGroups, reportRequest, sensitivityTables, simulationRows } from './report'

const N = ' '
const field = (over: Partial<ParamField>): ParamField => ({ key: 'k', label: 'L', group: 'g', type: 'number', required: true, ...over })

describe('formatParamValue', () => {
  it('число с единицей, список — подпись варианта, да/нет, пусто — прочерк', () => {
    expect(formatParamValue(field({ unit: 'м²' }), 12000)).toBe(`12${N}000${N}м²`)
    expect(formatParamValue(field({ type: 'enum', options: [{ value: '2x8', label: '2 смены по 8 ч' }] }), '2x8')).toBe('2 смены по 8 ч')
    expect(formatParamValue(field({ type: 'boolean' }), true)).toBe('Да')
    expect(formatParamValue(field({ type: 'boolean' }), false)).toBe('Нет')
    expect(formatParamValue(field({}), null)).toBe('—')
  })
})

describe('paramGroups', () => {
  it('все поля склада по группам, источник — только у значения по умолчанию', () => {
    const wh = objectTypes[0]!
    const groups = paramGroups(wh, wh.demoParams)
    expect(groups.flatMap((g) => g.rows)).toHaveLength(wh.fields.length)
    const rows = groups.flatMap((g) => g.rows)
    expect(rows.find((r) => r.key === 'unitLengthM')!.source).toContain('ГОСТ')
    expect(rows.find((r) => r.key === 'staffCostMonthRub')!.source).toContain('(допущение)')
    const changed = paramGroups(wh, { ...wh.demoParams, unitLengthM: 1 }).flatMap((g) => g.rows)
    expect(changed.find((r) => r.key === 'unitLengthM')!.source).toBeNull()
  })
})

describe('reportRequest', () => {
  it('гостевой расчёт с чувствительностью по трём параметрам', () => {
    const req = reportRequest({ objectType: 'warehouse', processes: ['picking'], params: {}, assumptions: defaultAssumptions, scenarios: [], simulation: null })
    expect(req.projectId).toBeNull()
    expect(req.sensitivity.params).toEqual(['equipmentPrice', 'operationsVolume', 'laborCost'])
    expect(req.sensitivity.deltas).toHaveLength(4)
  })
})

describe('sensitivityTables', () => {
  const scenario = { id: 'p', title: 'Покупка', metrics: { paybackYears: { value: 4.38 } } } as unknown as ScenarioResult
  const series: SensitivitySeries[] = [
    { scenarioId: 'p', param: 'laborCost', label: 'Стоимость труда', points: [{ delta: -0.1, paybackYears: null, roiPercent: null, annualEffectRub: 0 }, { delta: 0.1, paybackYears: 3.85, roiPercent: 1, annualEffectRub: 1 }] },
  ]
  it('столбец 0 % — текущий срок, null — «не окупается»', () => {
    const [t] = sensitivityTables([scenario], series)
    expect(t!.deltas).toEqual([-0.1, 0, 0.1])
    expect(t!.rows[0]!.cells).toEqual(['не окупается', `4,4${N}года`, `3,9${N}года`])
  })
  it('сценарий без рядов не выводится', () => {
    expect(sensitivityTables([scenario], [])).toEqual([])
  })
  it('подписи отклонений', () => {
    expect(deltaLabel(-0.2)).toBe(`−20${N}%`)
    expect(deltaLabel(0.1)).toBe(`+10${N}%`)
  })
})

describe('simulationRows', () => {
  it('нет KPI — null; есть — строки с выводом и сценарием', () => {
    expect(simulationRows(null)).toBeNull()
    const kpi: SimKpi = { engineVersion: 'sim-1.2', seed: 1, throughputPerHour: 424.8, targetPerHour: 447, achievedPercent: 95, avgUtilization: 0.631, idleShare: 0.369, chargingShare: 0, maxQueue: 7, bottleneck: 'Маршрут', confirmsCalculation: true }
    const rows = simulationRows(kpi, 'Покупка')!
    expect(rows[0]).toEqual({ label: 'Сценарий', value: 'Покупка' })
    expect(rows.find((r) => r.label === 'Вывод')!.value).toBe('Симуляция подтверждает расчёт')
  })
})
