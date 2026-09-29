import { describe, expect, it } from 'vitest'
import type { Layout, Metric, MetricKey, Robot, ScenarioResult } from '@/types/api'
import { DEFAULT_ASSUMPTIONS } from './projects'
import { SIM_FALLBACK, SIM_HOURS, avgRouteM, buildSimInput, targetPerHour } from './simInput'

const layout: Layout = {
  widthM: 120,
  heightM: 100,
  zones: [
    { id: 'z-receiving', type: 'receiving', label: 'Приёмка', rect: [0, 0, 25, 40] },
    { id: 'z-storage', type: 'storage', label: 'Хранение', rect: [30, 0, 90, 70] },
    { id: 'z-charging', type: 'charging', label: 'Зарядка', rect: [95, 80, 25, 20], slots: 4 },
  ],
}

const robot: Robot = {
  id: 'r1', name: 'Робот', manufacturer: 'Завод', solutionType: 'amr', solutionTypeName: 'AMR',
  objectTypes: ['warehouse'], country: null, availability: null,
  price: 4_200_000, raasMonthlyPrice: 115_000, maintenancePerYear: 320_000,
  specs: { speedMps: 1.6, autonomyH: 10, chargeTimeH: 1.5, perfOpsPerHour: 45 },
  sourceUrl: null, sourceDate: null, confirmed: true,
}

function scenario(robotCount: number | null, inputs?: Record<string, number>): ScenarioResult {
  const keys: MetricKey[] = ['robotCount', 'capexRub', 'opexAnnualRub', 'opexDeltaRub', 'annualEffectRub', 'paybackYears', 'roiPercent', 'tcoRub']
  const metrics = Object.fromEntries(
    keys.map((key): [MetricKey, Metric] => [
      key,
      { label: key, value: key === 'robotCount' ? robotCount : 1, unit: '', formula: '', overridden: false, ...(key === 'robotCount' && inputs ? { inputs } : {}) },
    ]),
  ) as Record<MetricKey, Metric>
  return { id: 'purchase', kind: 'purchase', title: 'Покупка', robotId: 'r1', equipment: [], metrics, cashflow: [], verdict: { level: 'good', label: '', interpretation: '', risks: [] } }
}

const params = { avgRouteM: 120, processPerfPerHour: 350, inboundPerDay: 1200, internalPerDay: 2500, outboundPerDay: 1800 }

describe('targetPerHour', () => {
  it('берёт значение, по которому сервер считал парк', () => {
    const result = targetPerHour(scenario(8, { targetPerHour: 447 }), params, DEFAULT_ASSUMPTIONS)
    expect(result.value).toBe(447)
    expect(result.note).toBeNull()
  })

  it('без данных сервера — производительность процесса из параметров', () => {
    expect(targetPerHour(scenario(8), params, DEFAULT_ASSUMPTIONS).value).toBe(350)
  })

  it('нет явной производительности — оценка по суточным объёмам, с пометкой', () => {
    const a = { ...DEFAULT_ASSUMPTIONS, shiftsPerDay: 2, hoursPerShift: 8 }
    const result = targetPerHour(scenario(8), { inboundPerDay: 1200, outboundPerDay: 1800 }, a)
    expect(result.value).toBe(3000 / 16)
    expect(result.note).toContain('суточным объёмам')
  })

  it('нет вообще никаких данных — подстановка с пометкой', () => {
    const result = targetPerHour(scenario(8), {}, DEFAULT_ASSUMPTIONS)
    expect(result.value).toBe(SIM_FALLBACK.peakOpsPerHour)
    expect(result.note).not.toBeNull()
  })
})

describe('avgRouteM', () => {
  it('из параметров объекта', () => {
    expect(avgRouteM({ avgRouteM: 120 }, layout)).toEqual({ value: 120, note: null })
    expect(avgRouteM({ bagTransferM: 450 }, layout).value).toBe(450)
  })

  it('без параметра — оценка по размеру плана, с пометкой', () => {
    const result = avgRouteM({}, layout)
    expect(result.value).toBe(110)
    expect(result.note).toContain('110')
  })
})

describe('buildSimInput', () => {
  it('число роботов — из расчёта, характеристики — из каталога', () => {
    const { input, robotCount, notes } = buildSimInput({
      layout, params, assumptions: DEFAULT_ASSUMPTIONS, scenario: scenario(9, { targetPerHour: 447 }), robot,
    })
    expect(robotCount).toBe(9)
    expect(input.robots).toEqual({ count: 9, speedMps: 1.6, opsPerHour: 45, autonomyH: 10, chargeTimeH: 1.5 })
    expect(input.demand).toEqual({ peakOpsPerHour: 447, avgRouteM: 120 })
    expect(input.simHours).toBe(SIM_HOURS)
    expect(input.layout).toBe(layout)
    expect(notes).toHaveLength(0)
  })

  it('один и тот же вход даёт одно и то же зерно', () => {
    const args = { layout, params, assumptions: DEFAULT_ASSUMPTIONS, scenario: scenario(9), robot }
    expect(buildSimInput(args).input.seed).toBe(buildSimInput(args).input.seed)
  })

  it('пустые характеристики робота — подстановки с пометками', () => {
    const bare: Robot = { ...robot, specs: {} }
    const { input, notes } = buildSimInput({
      layout, params, assumptions: DEFAULT_ASSUMPTIONS, scenario: scenario(4, { targetPerHour: 300 }), robot: bare,
    })
    expect(input.robots.speedMps).toBe(SIM_FALLBACK.speedMps)
    expect(input.robots.autonomyH).toBe(SIM_FALLBACK.autonomyH)
    expect(input.robots.chargeTimeH).toBe(SIM_FALLBACK.chargeTimeH)
    expect(input.robots.opsPerHour).toBeUndefined()
    expect(notes).toHaveLength(4)
    expect(notes.join(' ')).toContain('Скорость робота не указана')
    expect(notes.join(' ')).toContain('Производительность робота не указана')
  })

  it('нет числа роботов — ноль, прогон всё равно собирается', () => {
    const { input, robotCount } = buildSimInput({
      layout, params, assumptions: DEFAULT_ASSUMPTIONS, scenario: scenario(null), robot: null,
    })
    expect(robotCount).toBe(0)
    expect(input.robots.count).toBe(0)
  })
})
