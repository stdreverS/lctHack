import { describe, expect, it } from 'vitest'
import { SIM_MODEL, runSimulation } from '@/sim/engine'
import { buildSimInput } from '@/utils/simInput'
import { objectTypes } from './objectTypes'
import { calculations, demoSimKpi, projects } from './projects'
import { robots } from './robots'

describe('demoSimKpi', () => {
  it('совпадает с прогоном симуляции на сохранённом расчёте «Подольска»', () => {
    const scenario = calculations[0]!.result.scenarios.find((s) => s.kind === 'purchase')!
    const { input } = buildSimInput({
      layout: objectTypes[0]!.layout!,
      params: projects[0]!.params,
      assumptions: projects[0]!.assumptions,
      scenario,
      robot: robots.find((r) => r.id === scenario.robotId)!,
    })
    expect(runSimulation(input).kpi).toEqual(demoSimKpi)
  })

  it('цель, процент и вердикт согласованы', () => {
    expect(demoSimKpi.achievedPercent).toBeCloseTo((demoSimKpi.throughputPerHour / demoSimKpi.targetPerHour) * 100, 0)
    expect(demoSimKpi.confirmsCalculation).toBe(demoSimKpi.achievedPercent >= SIM_MODEL.confirmPercent)
    expect(demoSimKpi.targetPerHour).toBe(calculations[0]!.result.scenarios[1]!.metrics.robotCount.inputs!.targetPerHour)
  })
})
