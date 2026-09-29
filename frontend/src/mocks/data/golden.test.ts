// Эталонные расчёты модели мока: запрос → результат. Тот же файл проверяет серверное ядро
// (backend/tests/Robo.Tests/GoldenCalculationTests.cs), так что расхождение Robo.Core и мока
// ловится тестами с обеих сторон.
// После намеренного изменения модели: `npx vitest run -u src/mocks/data/golden.test.ts`,
// затем `dotnet test` в backend.
import { describe, expect, it } from 'vitest'
import type { CalcRequest, SensParam } from '@/types/api'
import { buildCalcResult } from './calculation'
import { defaultAssumptions, objectTypes } from './objectTypes'
import { defaultScenarios } from './projects'
import { ROBOT_IDS, robots } from './robots'

const GOLDEN_FILE = '../../../../backend/tests/Robo.Tests/Golden/mock-calculations.json'
const FIXED_TIME = '2026-01-01T00:00:00.000Z'
const ALL_SENS: SensParam[] = ['equipmentPrice', 'operationsVolume', 'laborCost']
const DELTAS = [-0.2, -0.1, 0.1, 0.2]

const type = (code: string) => objectTypes.find((t) => t.code === code)!
const allProcesses = (code: string) => type(code).processes.map((p) => p.code)

function request(objectType: string, patch: Partial<CalcRequest>): CalcRequest {
  return {
    projectId: null,
    objectType,
    processes: allProcesses(objectType),
    params: { ...type(objectType).demoParams },
    assumptions: { ...defaultAssumptions },
    scenarios: [],
    sensitivity: { params: ALL_SENS, deltas: DELTAS },
    ...patch,
  }
}

const cases: { name: string; request: CalcRequest }[] = [
  {
    // Демо-склад из docs/economics.md: 15 × AMR-600, окупаемость 4,38 года, ROI 114,3 %
    name: 'warehouse-demo',
    request: request('warehouse', {
      scenarios: defaultScenarios().map((s) => (s.kind === 'raas' ? { ...s, raas: { ...s.raas!, setupRub: 1_500_000 } } : s)),
    }),
  },
  {
    // Ручные правки what-if, робот без производительности и без цены аренды, другие допущения
    name: 'warehouse-overrides',
    request: request('warehouse', {
      processes: ['internal_transport', 'picking'],
      params: { ...type('warehouse').demoParams, inboundPerDay: 700, internalPerDay: 1300, outboundPerDay: 900, processPerfPerHour: 180, staffCount: 38, staffCostMonthRub: 78_000, aisleWidthM: 2.8 },
      assumptions: { ...defaultAssumptions, shiftsPerDay: 3, workDaysPerYear: 300, reserveShare: 0.15 },
      scenarios: [
        { id: 'base', kind: 'baseline', title: 'Как сейчас', robotId: null },
        { id: 'amr1500', kind: 'purchase', title: 'AMR-1500, 6 шт.', robotId: ROBOT_IDS.amr1500, overrides: { robotCount: 6, unitPriceRub: 6_500_000, maintenancePerYearRub: 400_000 } },
        { id: 'fmr12', kind: 'purchase', title: 'ФМР-12 по оценке', robotId: ROBOT_IDS.fmr12narrow, overrides: { perfOpsPerHour: 30 } },
        { id: 'fmr12-rent', kind: 'raas', title: 'ФМР-12 в аренду', robotId: ROBOT_IDS.fmr12narrow, overrides: { robotCount: 3 }, raas: { monthlyFeePerRobotRub: 250_000, contractYears: 5, setupRub: 2_000_000 } },
      ],
      sensitivity: { params: ['operationsVolume', 'equipmentPrice'], deltas: [-0.3, 0.5] },
    }),
  },
  {
    // Большой поток: парк больше предела maxFleet; без массы груза и ширины прохода
    name: 'warehouse-heavy',
    request: request('warehouse', {
      params: { ...type('warehouse').demoParams, processPerfPerHour: 5000, unitWeightKg: null, aisleWidthM: null },
      scenarios: [{ id: 'buy', kind: 'purchase', title: 'Покупка АТ-3000', robotId: ROBOT_IDS.tugger3000 }],
      sensitivity: { params: ['laborCost'], deltas: [-0.1, 0.1] },
    }),
  },
  {
    name: 'airport-demo',
    request: request('airport', {
      scenarios: [
        { id: 'baseline', kind: 'baseline', title: 'Текущее состояние', robotId: null },
        { id: 'purchase', kind: 'purchase', title: 'Покупка Аэро-Б', robotId: ROBOT_IDS.baggage },
        { id: 'raas', kind: 'raas', title: 'Аренда Аэро-Б', robotId: ROBOT_IDS.baggage },
      ],
    }),
  },
  {
    // Без сценариев: подбор и один baseline; уборщик попадает в подбор (процесс cleaning)
    name: 'hospital-no-scenarios',
    request: request('hospital', {}),
  },
]

describe('эталонные расчёты модели мока (общие с Robo.Core)', () => {
  it('совпадают с Golden/mock-calculations.json', async () => {
    const golden = cases.map(({ name, request }) => ({
      name,
      request,
      result: { ...buildCalcResult(request, robots, null), calculatedAt: FIXED_TIME },
    }))
    await expect(JSON.stringify(golden, null, 2) + '\n').toMatchFileSnapshot(GOLDEN_FILE)
  })
})
