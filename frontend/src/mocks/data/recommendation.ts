// Мок-подбор роботов: проверки ограничений и балл. Статус — по правилу контракта.
import type { Check, Params, RecStatus, RecommendationItem, Robot, ScoreFactor } from '@/types/api'
import { formatNumber } from '@/utils/format'
import {
  availableAisleM,
  economics,
  fleetSize,
  MOCK_CONST,
  purchaseCapex,
  purchaseRobotOpex,
  requiredPayloadKg,
  type ModelInputs,
} from './model'

const SPEC_LABELS: Record<string, string> = {
  payloadKg: 'Грузоподъёмность',
  perfOpsPerHour: 'Производительность',
  minAisleM: 'Минимальная ширина прохода',
  autonomyH: 'Время автономной работы',
  chargeTimeH: 'Время зарядки',
  lifeYears: 'Срок службы',
}

function check(
  rule: string,
  label: string,
  critical: boolean,
  result: Check['result'],
  message: string,
  required: number | string | null = null,
  actual: number | string | null = null,
  unit: string | null = null,
): Check {
  return { rule, label, critical, result, required, actual, unit, message }
}

function buildChecks(robot: Robot, params: Params, inputs: ModelInputs): Check[] {
  const s = robot.specs
  const checks: Check[] = []
  const isCleaner = robot.solutionType === 'cleaner'

  const payload = requiredPayloadKg(params)
  if (payload !== null && !isCleaner) {
    checks.push(
      s.payloadKg == null
        ? check('payload', 'Грузоподъёмность', true, 'unknown', 'Производитель не указал грузоподъёмность — уточните её перед выбором', payload, null, 'кг')
        : s.payloadKg >= payload
          ? check('payload', 'Грузоподъёмность', true, 'pass', `Грузоподъёмность ${formatNumber(s.payloadKg)} кг достаточна для единицы ${formatNumber(payload)} кг`, payload, s.payloadKg, 'кг')
          : check('payload', 'Грузоподъёмность', true, 'fail', `Грузоподъёмность ${formatNumber(s.payloadKg)} кг меньше массы единицы ${formatNumber(payload)} кг`, payload, s.payloadKg, 'кг'),
    )
  }

  const aisle = availableAisleM(params)
  if (aisle !== null && robot.solutionType !== 'asrs') {
    checks.push(
      s.minAisleM == null
        ? check('aisle', 'Ширина прохода', true, 'unknown', 'Нет данных о минимальной ширине прохода — запросите у производителя', aisle, null, 'м')
        : s.minAisleM <= aisle
          ? check('aisle', 'Ширина прохода', true, 'pass', `Роботу нужно ${formatNumber(s.minAisleM)} м, на объекте ${formatNumber(aisle)} м`, aisle, s.minAisleM, 'м')
          : check('aisle', 'Ширина прохода', true, 'fail', `Роботу нужен проход ${formatNumber(s.minAisleM)} м, а на объекте только ${formatNumber(aisle)} м`, aisle, s.minAisleM, 'м'),
    )
  }

  if (!isCleaner) {
    const fleet = fleetSize(inputs.targetPerHour, robot, inputs.assumptions)
    const target = Math.round(inputs.targetPerHour)
    checks.push(
      fleet === null
        ? check('performance', 'Производительность', true, 'unknown', 'Производительность не указана — число роботов нельзя оценить', target, null, 'опер./ч')
        : fleet <= MOCK_CONST.maxFleet
          ? check('performance', 'Производительность', true, 'pass', `Целевые ${formatNumber(target)} опер./ч обеспечат ${fleet} роб.`, target, s.perfOpsPerHour ?? null, 'опер./ч')
          : check('performance', 'Производительность', true, 'fail', `Потребуется ${fleet} роботов — больше разумного размера парка (${MOCK_CONST.maxFleet})`, target, s.perfOpsPerHour ?? null, 'опер./ч'),
    )
  }

  const shift = inputs.assumptions.hoursPerShift
  checks.push(
    s.autonomyH == null
      ? check('autonomy', 'Автономность', false, 'unknown', 'Время автономной работы не указано', shift, null, 'ч')
      : s.autonomyH >= shift
        ? check('autonomy', 'Автономность', false, 'pass', `Заряда хватает на смену (${formatNumber(s.autonomyH)} ч)`, shift, s.autonomyH, 'ч')
        : check('autonomy', 'Автономность', false, 'fail', `Заряда хватает на ${formatNumber(s.autonomyH)} ч — понадобится подзарядка в смену`, shift, s.autonomyH, 'ч'),
  )

  checks.push(
    robot.confirmed
      ? check('dataConfirmed', 'Достоверность данных', false, 'pass', 'Характеристики подтверждены источником')
      : check('dataConfirmed', 'Достоверность данных', false, 'unknown', 'Характеристики не подтверждены — используйте оценку с осторожностью'),
  )
  return checks
}

function statusOf(checks: Check[]): RecStatus {
  if (checks.some((c) => c.critical && c.result === 'fail')) return 'excluded'
  if (checks.some((c) => c.critical && c.result === 'unknown')) return 'needs_check'
  return 'recommended'
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

function scoreFactors(robot: Robot, checks: Check[], inputs: ModelInputs, maxPerf: number): ScoreFactor[] {
  const fleet = fleetSize(inputs.targetPerHour, robot, inputs.assumptions)
  let economy = 40
  if (fleet !== null) {
    const e = economics(inputs, fleet, purchaseCapex(fleet, robot.price), purchaseRobotOpex(fleet, robot, inputs.assumptions))
    economy = e.paybackYears === null ? 0 : clamp(100 - e.paybackYears * 15)
  }
  const perf = robot.specs.perfOpsPerHour
  const passed = checks.filter((c) => c.result === 'pass').length
  const avail = robot.availability === 'В наличии' ? 100 : robot.availability ? 75 : 30
  const raw: Omit<ScoreFactor, 'contribution'>[] = [
    { factor: 'economy', label: 'Экономика (окупаемость)', weight: 0.35, value: economy },
    { factor: 'performance', label: 'Производительность', weight: 0.25, value: perf ? clamp((perf / maxPerf) * 100) : 0 },
    { factor: 'fit', label: 'Соответствие объекту', weight: 0.2, value: clamp((passed / checks.length) * 100) },
    { factor: 'dataQuality', label: 'Полнота и достоверность данных', weight: 0.1, value: robot.confirmed ? 100 : 40 },
    { factor: 'availability', label: 'Доступность поставки', weight: 0.1, value: avail },
  ]
  return raw.map((f) => ({ ...f, contribution: Math.round(f.weight * f.value * 10) / 10 }))
}

const ORDER: Record<RecStatus, number> = { recommended: 0, needs_check: 1, excluded: 2 }

export function buildRecommendation(
  catalog: Robot[],
  objectType: string,
  processes: string[],
  params: Params,
  inputs: ModelInputs,
): RecommendationItem[] {
  const candidates = catalog.filter(
    (r) => r.objectTypes.includes(objectType) && (r.solutionType !== 'cleaner' || processes.includes('cleaning')),
  )
  const maxPerf = Math.max(1, ...candidates.map((r) => (r.solutionType === 'asrs' ? 0 : (r.specs.perfOpsPerHour ?? 0))))

  return candidates
    .map((robot): RecommendationItem => {
      const checks = buildChecks(robot, params, inputs)
      const status = statusOf(checks)
      const breakdown = status === 'excluded' ? [] : scoreFactors(robot, checks, inputs, maxPerf)
      const score =
        status === 'excluded' ? null : Math.round(breakdown.reduce((sum, f) => sum + f.contribution, 0) * 10) / 10
      const missingData = Object.entries(SPEC_LABELS)
        .filter(([key]) => robot.specs[key as keyof Robot['specs']] == null)
        .map(([, label]) => label)
      return { robotId: robot.id, name: robot.name, solutionType: robot.solutionType, status, score, checks, scoreBreakdown: breakdown, missingData }
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.score ?? 0) - (a.score ?? 0))
}
