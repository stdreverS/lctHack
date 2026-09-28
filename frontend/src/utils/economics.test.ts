import { describe, expect, it } from 'vitest'
import type { Metric, MetricKey, ScenarioKind, ScenarioResult } from '@/types/api'
import { bestScenario, formatMetricValue, formatPayback, metricInputs } from './economics'

const N = ' '

function scenario(id: string, kind: ScenarioKind, payback: number | null): ScenarioResult {
  const m: Metric = { label: '', value: null, unit: '', formula: '', overridden: false }
  const metrics = Object.fromEntries(
    (['robotCount', 'capexRub', 'opexAnnualRub', 'opexDeltaRub', 'annualEffectRub', 'paybackYears', 'roiPercent', 'tcoRub'] as MetricKey[])
      .map((k) => [k, { ...m }]),
  ) as Record<MetricKey, Metric>
  metrics.paybackYears.value = payback
  return {
    id, kind, title: id, robotId: null, equipment: [], metrics, cashflow: [],
    verdict: { level: 'good', label: '', interpretation: '', risks: [] },
  }
}

describe('formatMetricValue', () => {
  it('форматирует по единице', () => {
    expect(formatMetricValue(12_400_000, '₽')).toBe(`12${N}400${N}000${N}₽`)
    expect(formatMetricValue(-1_500_000, '₽/год')).toBe(`-1${N}500${N}000${N}₽/год`)
    expect(formatMetricValue(2.44, 'лет')).toBe(`2,4${N}года`)
    expect(formatMetricValue(31.46, '%')).toBe(`31,5${N}%`)
    expect(formatMetricValue(12, 'шт.')).toBe(`12${N}шт.`)
    expect(formatMetricValue(0.75, '')).toBe('0,75')
  })
  it('нет значения → прочерк', () => {
    expect(formatMetricValue(null, '₽')).toBe('—')
    expect(formatMetricValue(Number.NaN, '%')).toBe('—')
  })
})

describe('formatPayback', () => {
  it('число — в годах; null у сценария с роботами — «не окупается», у текущего — прочерк', () => {
    expect(formatPayback(1, 'purchase')).toBe(`1${N}год`)
    expect(formatPayback(null, 'raas')).toBe('не окупается')
    expect(formatPayback(null, 'baseline')).toBe('—')
  })
})

describe('bestScenario', () => {
  it('наименьшая окупаемость среди сценариев с роботами', () => {
    const list = [scenario('base', 'baseline', 0.1), scenario('buy', 'purchase', 3.2), scenario('rent', 'raas', 1.4)]
    expect(bestScenario(list)?.id).toBe('rent')
  })
  it('неокупаемые пропускаются; если окупаемых нет — null', () => {
    expect(bestScenario([scenario('buy', 'purchase', null), scenario('rent', 'raas', 4)])?.id).toBe('rent')
    expect(bestScenario([scenario('buy', 'purchase', null)])).toBeNull()
    expect(bestScenario([])).toBeNull()
  })
})

describe('metricInputs', () => {
  it('подписи из словаря, затем из допущений, иначе ключ', () => {
    const rows = metricInputs(
      { inputs: { targetPerHour: 447.5, staffCostMonthRub: 95000, custom: 3 } },
      [{ key: 'staffCostMonthRub', label: 'Стоимость сотрудника', value: 95000, unit: '₽/мес', source: '', confirmed: true }],
    )
    expect(rows).toEqual([
      { key: 'targetPerHour', label: 'Целевая производительность, опер./ч', value: '447,5' },
      { key: 'staffCostMonthRub', label: 'Стоимость сотрудника', value: `95${N}000` },
      { key: 'custom', label: 'custom', value: '3' },
    ])
  })
  it('без inputs — пустой список', () => {
    expect(metricInputs({})).toEqual([])
  })
})
