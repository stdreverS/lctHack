import { describe, expect, it } from 'vitest'
import type { Check, RecommendationItem, ScenarioInput } from '@/types/api'
import {
  checkValues,
  contributionBars,
  failedCritical,
  groupRecommendations,
  patchScenario,
  scenarioRobotId,
  withScenarioRobot,
} from './recommendation'

const N = '\u00A0'

function item(name: string, status: RecommendationItem['status'], score: number | null): RecommendationItem {
  return { robotId: name, name, solutionType: 'amr', status, score, checks: [], scoreBreakdown: [], missingData: [] }
}

function check(partial: Partial<Check>): Check {
  return { rule: 'r', label: 'Проверка', critical: true, result: 'pass', message: '', ...partial }
}

describe('groupRecommendations', () => {
  it('три группы в фиксированном порядке, внутри — по убыванию балла', () => {
    const groups = groupRecommendations([
      item('Б', 'recommended', 60),
      item('В', 'excluded', null),
      item('А', 'recommended', 80),
      item('Г', 'needs_check', 40),
    ])
    expect(groups.map((g) => g.label)).toEqual(['Рекомендовано', 'Требует проверки', 'Не подходит'])
    expect(groups[0]!.items.map((i) => i.name)).toEqual(['А', 'Б'])
    expect(groups[1]!.items.map((i) => i.name)).toEqual(['Г'])
    expect(groups[2]!.items.map((i) => i.name)).toEqual(['В'])
  })

  it('пустая группа остаётся в списке; без балла — в конце, затем по алфавиту', () => {
    const groups = groupRecommendations([item('Я', 'needs_check', null), item('А', 'needs_check', null), item('М', 'needs_check', 10)])
    expect(groups[0]!.items).toEqual([])
    expect(groups[1]!.items.map((i) => i.name)).toEqual(['М', 'А', 'Я'])
  })

  it('не меняет исходный массив', () => {
    const list = [item('Б', 'recommended', 1), item('А', 'recommended', 2)]
    groupRecommendations(list)
    expect(list.map((i) => i.name)).toEqual(['Б', 'А'])
  })
})

describe('checkValues', () => {
  it('требуемое и фактическое значение с единицей', () => {
    expect(checkValues({ required: 1200, actual: 600, unit: 'кг' })).toBe(`требуется 1${N}200${N}кг, у робота 600${N}кг`)
  })
  it('нет значения у робота → «нет данных»', () => {
    expect(checkValues({ required: 3, actual: null, unit: 'м' })).toBe(`требуется 3${N}м, у робота нет данных`)
  })
  it('строковые значения и отсутствие единицы', () => {
    expect(checkValues({ required: 'SLAM', actual: 'Магнитная лента', unit: null })).toBe('требуется SLAM, у робота Магнитная лента')
  })
  it('нечего сравнивать → пустая строка', () => {
    expect(checkValues({ required: null, actual: undefined, unit: 'ч' })).toBe('')
  })
})

describe('failedCritical', () => {
  it('только критические проверки с результатом fail', () => {
    const checks = [
      check({ rule: 'a', result: 'fail' }),
      check({ rule: 'b', result: 'fail', critical: false }),
      check({ rule: 'c', result: 'unknown' }),
    ]
    expect(failedCritical({ checks }).map((c) => c.rule)).toEqual(['a'])
  })
})

describe('contributionBars', () => {
  it('масштаб — наибольший возможный вклад', () => {
    const bars = contributionBars([
      { weight: 0.35, contribution: 17.5 },
      { weight: 0.1, contribution: 10 },
    ])
    expect(bars[0]).toEqual({ track: 100, fill: 50 })
    expect(bars[1]!.track).toBeCloseTo(28.57, 1)
    expect(bars[1]!.fill).toBeCloseTo(28.57, 1)
  })
  it('пустой список и нулевые веса не дают NaN', () => {
    expect(contributionBars([])).toEqual([])
    expect(contributionBars([{ weight: 0, contribution: 0 }])).toEqual([{ track: 0, fill: 0 }])
  })
})

describe('withScenarioRobot', () => {
  it('добавляет baseline и сценарий в порядке baseline → purchase → raas', () => {
    let list: ScenarioInput[] = []
    list = withScenarioRobot(list, 'raas', 'r2')
    list = withScenarioRobot(list, 'purchase', 'r1')
    expect(list.map((x) => [x.kind, x.robotId])).toEqual([
      ['baseline', null],
      ['purchase', 'r1'],
      ['raas', 'r2'],
    ])
    expect(scenarioRobotId(list, 'purchase')).toBe('r1')
    expect(scenarioRobotId(list, 'raas')).toBe('r2')
  })

  it('ручные правки сохраняются для того же робота и сбрасываются при смене', () => {
    const list: ScenarioInput[] = [
      { id: 'baseline', kind: 'baseline', title: 'Текущее состояние', robotId: null },
      { id: 'purchase', kind: 'purchase', title: 'Покупка', robotId: 'r1', overrides: { robotCount: 5 } },
    ]
    expect(withScenarioRobot(list, 'purchase', 'r1')[1]!.overrides).toEqual({ robotCount: 5 })
    expect(withScenarioRobot(list, 'purchase', 'r2')[1]!.overrides).toBeUndefined()
  })

  it('null убирает сценарий', () => {
    const list = withScenarioRobot(withScenarioRobot([], 'purchase', 'r1'), 'raas', 'r1')
    const next = withScenarioRobot(list, 'purchase', null)
    expect(next.map((x) => x.kind)).toEqual(['baseline', 'raas'])
    expect(scenarioRobotId(next, 'purchase')).toBeNull()
  })
})

describe('patchScenario', () => {
  it('меняет только сценарий указанного вида', () => {
    const list = withScenarioRobot(withScenarioRobot([], 'purchase', 'r1'), 'raas', 'r2')
    const next = patchScenario(list, 'raas', { raas: { monthlyFeePerRobotRub: 100, contractYears: 3, setupRub: 5 } })
    expect(next.find((x) => x.kind === 'raas')?.raas?.monthlyFeePerRobotRub).toBe(100)
    expect(next.find((x) => x.kind === 'purchase')).toBe(list.find((x) => x.kind === 'purchase'))
  })
})
