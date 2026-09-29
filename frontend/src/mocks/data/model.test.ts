import { describe, expect, it } from 'vitest'
import { buildCalcResult } from './calculation'
import { defaultAssumptions, objectTypes } from './objectTypes'
import { defaultScenarios } from './projects'
import { robots } from './robots'

describe('ROI (п. 3.5.2 ТЗ)', () => {
  const result = buildCalcResult({
    projectId: null,
    objectType: 'warehouse',
    processes: ['internal_transport'],
    params: { ...objectTypes[0]!.demoParams },
    assumptions: { ...defaultAssumptions },
    scenarios: defaultScenarios().map((s) => (s.kind === 'raas' ? { ...s, raas: { ...s.raas!, setupRub: 1_500_000 } } : s)),
    sensitivity: { params: [], deltas: [] },
  }, robots, null)
  const byKind = (kind: string) => result.scenarios.find((s) => s.kind === kind)!

  it('накопленный эффект за горизонт / CAPEX × 100 %: демо-склад', () => {
    expect(byKind('purchase').metrics.roiPercent.value).toBe(114.3)
    expect(byKind('raas').metrics.roiPercent.value).toBe(236)
  })

  it('формула в ответе — по ТЗ', () => {
    expect(byKind('purchase').metrics.roiPercent.formula).toContain('Накопленный эффект')
  })

  it('без капзатрат ROI не считается', () => {
    expect(byKind('baseline').metrics.roiPercent.value).toBeNull()
  })
})
