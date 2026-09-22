import type { CalcRequest, CalculationRecord, Project, ScenarioInput, SimKpi } from '@/types/api'
import { buildCalcResult } from './calculation'
import { defaultAssumptions, objectTypes } from './objectTypes'
import { ROBOT_IDS, robots } from './robots'
import { USER_ID } from './users'

export interface MockProject extends Project {
  ownerId: string
}

export interface MockCalculation extends CalculationRecord {
  projectId: string
  ownerId: string
}

const warehouseDemo = objectTypes.find((t) => t.code === 'warehouse')!.demoParams

export const PROJECT_IDS = {
  podolsk: 'c2d4e6f8-2222-4b02-9d02-000000000001',
  kazan: 'c2d4e6f8-2222-4b02-9d02-000000000002',
} as const

export const projects: MockProject[] = [
  {
    id: PROJECT_IDS.podolsk,
    ownerId: USER_ID,
    name: 'РЦ «Подольск» — роботизация внутреннего транспорта',
    objectType: 'warehouse',
    params: { ...warehouseDemo },
    assumptions: { ...defaultAssumptions },
    createdAt: '2026-09-01T07:30:00Z',
    updatedAt: '2026-09-15T12:10:00Z',
  },
  {
    id: PROJECT_IDS.kazan,
    ownerId: USER_ID,
    name: 'Склад «Казань-Север» — ночная смена',
    objectType: 'warehouse',
    params: { ...warehouseDemo, areaM2: 6500, workMode: '3x8', inboundPerDay: 700, internalPerDay: 1300, outboundPerDay: 900, processPerfPerHour: 180, staffCount: 38, staffCostMonthRub: 78000, aisleWidthM: 2.8 },
    assumptions: { ...defaultAssumptions, shiftsPerDay: 3, workDaysPerYear: 300 },
    createdAt: '2026-09-10T09:00:00Z',
    updatedAt: '2026-09-10T09:00:00Z',
  },
]

export function defaultScenarios(robotId: string = ROBOT_IDS.amr600): ScenarioInput[] {
  return [
    { id: 'baseline', kind: 'baseline', title: 'Текущее состояние', robotId: null },
    { id: 'purchase', kind: 'purchase', title: 'Покупка Логимов AMR-600', robotId },
    { id: 'raas', kind: 'raas', title: 'Аренда Логимов AMR-600 (RaaS)', robotId, raas: { monthlyFeePerRobotRub: 115_000, contractYears: 3, setupRub: 4_000_000 } },
  ]
}

/** KPI 2D-симуляции, приложенные к сохранённому расчёту (на результат мок-расчёта не влияют). */
export const demoSimKpi: SimKpi = {
  engineVersion: 'sim-1.0',
  seed: 42,
  throughputPerHour: 338,
  targetPerHour: 350,
  achievedPercent: 96.6,
  avgUtilization: 0.78,
  idleShare: 0.12,
  chargingShare: 0.1,
  maxQueue: 4,
  bottleneck: 'Зона приёмки: очередь на разгрузку в пиковый час',
  confirmsCalculation: true,
}

const seedRequest: CalcRequest = {
  projectId: PROJECT_IDS.podolsk,
  objectType: 'warehouse',
  processes: ['internal_transport', 'receiving'],
  params: { ...warehouseDemo },
  assumptions: { ...defaultAssumptions },
  scenarios: defaultScenarios(),
  sensitivity: { params: ['equipmentPrice', 'operationsVolume', 'laborCost'], deltas: [-0.2, -0.1, 0.1, 0.2] },
  simulation: demoSimKpi,
}
const SEED_CALC_ID = 'd3e5f7a9-3333-4c03-9e03-000000000001'
const seedResult = buildCalcResult(seedRequest, robots, SEED_CALC_ID)
seedResult.calculatedAt = '2026-09-15T12:10:00Z'

export const calculations: MockCalculation[] = [
  {
    id: SEED_CALC_ID,
    projectId: PROJECT_IDS.podolsk,
    ownerId: USER_ID,
    createdAt: seedResult.calculatedAt,
    request: seedRequest,
    result: seedResult,
  },
]
