import { describe, expect, it } from 'vitest'
import type { CalcResult, Metric, MetricKey, ScenarioKind, ScenarioResult } from '@/types/api'
import { EXPORT_METRICS, csvCell, csvNumber, exportFileName, scenariosCsv, usedRobots } from './export'

function scenario(kind: ScenarioKind, title: string, robotId: string | null, capex: number | null): ScenarioResult {
  const metrics = Object.fromEntries(
    EXPORT_METRICS.map((k) => [k, { label: `Метрика ${k}`, value: null, unit: 'ед.', formula: '', overridden: false } satisfies Metric]),
  ) as Record<MetricKey, Metric>
  metrics.capexRub = { ...metrics.capexRub, label: 'Капитальные затраты', unit: '₽', value: capex }
  metrics.paybackYears = { ...metrics.paybackYears, label: 'Окупаемость', unit: 'лет', value: kind === 'baseline' ? null : 2.456 }
  return {
    id: kind, kind, title, robotId, equipment: [], metrics, cashflow: [],
    verdict: { level: 'good', label: kind === 'baseline' ? 'Точка отсчёта' : 'Окупается до 3 лет', interpretation: '', risks: [] },
  }
}

const result: CalcResult = {
  calculationId: null,
  modelVersion: 'mock-1.0',
  dataVersion: 'catalog-2026.09',
  calculatedAt: '2026-09-23T10:00:00Z',
  disclaimer: 'Предварительная оценка; точность ±30 %',
  recommendation: [],
  scenarios: [
    scenario('baseline', 'Текущее состояние', null, 0),
    scenario('purchase', 'Покупка', 'r1', 12_400_000.5),
    scenario('raas', 'Аренда "RaaS"', 'r1', null),
  ],
  sensitivity: [],
  assumptionsUsed: [],
}

describe('csvNumber', () => {
  it('запятая, без разделителей разрядов, до 2 знаков', () => {
    expect(csvNumber(12_400_000)).toBe('12400000')
    expect(csvNumber(2.456)).toBe('2,46')
    expect(csvNumber(-0.001)).toBe('0')
    expect(csvNumber(null)).toBe('')
    expect(csvNumber(Number.NaN)).toBe('')
  })
})

describe('csvCell', () => {
  it('экранирует разделитель, кавычки и переносы', () => {
    expect(csvCell('просто')).toBe('просто')
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('Аренда "RaaS"')).toBe('"Аренда ""RaaS"""')
    expect(csvCell('две\nстроки')).toBe('"две\nстроки"')
    expect(csvCell(1.5)).toBe('1,5')
    expect(csvCell(null)).toBe('')
  })
})

describe('scenariosCsv', () => {
  const csv = scenariosCsv(result, { objectName: 'Склад', robotName: (id) => (id === 'r1' ? 'Логимов AMR-600' : null) })
  const lines = csv.slice(1).split('\r\n')

  it('начинается с BOM и заканчивается переводом строки', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('шапка и строка роботов', () => {
    expect(lines).toContain('Объект;Склад')
    expect(lines).toContain('Показатель;Единица;Текущее состояние;Покупка;"Аренда ""RaaS"""')
    expect(lines).toContain('Робот;;Без роботов;Логимов AMR-600;Логимов AMR-600')
  })

  it('значения метрик — числа сервера, пусто вместо null', () => {
    expect(lines).toContain('Капитальные затраты;₽;0;12400000,5;')
    expect(lines).toContain('Окупаемость;лет;;2,46;2,46')
    expect(lines.filter((l) => l.startsWith('Метрика '))).toHaveLength(EXPORT_METRICS.length - 2)
  })

  it('вывод и оговорка', () => {
    expect(lines).toContain('Вывод;;Точка отсчёта;Окупается до 3 лет;Окупается до 3 лет')
    expect(lines).toContain('Предварительная оценка; точность ±30 %'.replace(/^(.*)$/, '"$1"'))
  })
})

describe('exportFileName', () => {
  it('дата в формате ГГГГ-ММ-ДД', () => {
    expect(exportFileName('robo-scenarios', 'csv', new Date(2026, 8, 3))).toBe('robo-scenarios-2026-09-03.csv')
  })
})

describe('usedRobots', () => {
  it('объединяет сценарии одного робота и пропускает baseline', () => {
    const list = usedRobots(
      [
        { robotId: null, title: 'Текущее состояние' },
        { robotId: 'r1', title: 'Покупка' },
        { robotId: 'r2', title: 'Аренда' },
        { robotId: 'r1', title: 'Ещё' },
      ],
      (id) => (id === 'r1' ? 'AMR-600' : null),
    )
    expect(list).toEqual([
      { robotId: 'r1', name: 'AMR-600', scenarios: ['Покупка', 'Ещё'] },
      { robotId: 'r2', name: 'r2', scenarios: ['Аренда'] },
    ])
  })
})
