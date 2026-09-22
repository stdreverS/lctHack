// Мок POST /calculations: подбор, сценарии, чувствительность, допущения.
import type {
  AssumptionRef,
  CalcRequest,
  CalcResult,
  CashflowYear,
  EquipmentLine,
  Metric,
  MetricKey,
  Robot,
  ScenarioInput,
  ScenarioResult,
  SensParam,
  SensitivitySeries,
  Verdict,
} from '@/types/api'
import { MockFail } from '../fail'
import {
  chargers,
  economics,
  fleetSize,
  MOCK_CONST,
  purchaseCapex,
  purchaseRobotOpex,
  raasRobotOpex,
  readInputs,
  type Economics,
  type ModelInputs,
} from './model'
import { buildRecommendation } from './recommendation'

export const MODEL_VERSION = 'mock-1.0'
export const DATA_VERSION = 'catalog-2026.09'
const DISCLAIMER =
  'Предварительная оценка на основе введённых параметров и каталожных данных. Точность ±30 %. ' +
  'Не является инвестиционным решением: перед закупкой требуется обследование объекта и коммерческие предложения поставщиков.'

/** Множители для анализа чувствительности. */
interface Factors {
  price: number
  volume: number
  labor: number
}
const NO_FACTORS: Factors = { price: 1, volume: 1, labor: 1 }

function scaled(inputs: ModelInputs, f: Factors): ModelInputs {
  return {
    ...inputs,
    targetPerHour: inputs.targetPerHour * f.volume,
    staffCount: inputs.staffCount * f.volume,
    staffCostMonthRub: inputs.staffCostMonthRub * f.labor,
  }
}

interface Computed {
  econ: Economics
  equipment: EquipmentLine[]
  countOverridden: boolean
  priceOverridden: boolean
}

function line(item: string, qty: number, unitPriceRub: number): EquipmentLine {
  return { item, qty, unitPriceRub, totalRub: qty * unitPriceRub }
}

function computeScenario(s: ScenarioInput, robot: Robot | null, base: ModelInputs, f: Factors): Computed {
  const inputs = scaled(base, f)
  const a = inputs.assumptions
  if (s.kind === 'baseline' || !robot) {
    return { econ: economics(inputs, 0, 0, 0), equipment: [], countOverridden: false, priceOverridden: false }
  }
  const manualCount = s.overrides?.robotCount ?? null
  const count = manualCount ?? fleetSize(inputs.targetPerHour, robot, a)
  if (count === null) {
    throw new MockFail(422, 'CALCULATION_ERROR',
      `Для «${robot.name}» не указана производительность — задайте число роботов вручную`)
  }
  if (s.kind === 'purchase') {
    const manualPrice = s.overrides?.unitPriceRub ?? null
    const unitPrice = Math.round((manualPrice ?? robot.price) * f.price)
    const equipment = [
      line(robot.name, count, unitPrice),
      line('Зарядная станция', chargers(count), MOCK_CONST.chargerPriceRub),
      line('ПО управления парком и интеграция с WMS', 1, MOCK_CONST.integrationRub),
      line('Пусконаладка и обучение персонала', 1, MOCK_CONST.commissioningRub),
    ]
    const capex = equipment.reduce((sum, l) => sum + l.totalRub, 0)
    return {
      econ: economics(inputs, count, capex, purchaseRobotOpex(count, robot, a)),
      equipment, countOverridden: manualCount !== null, priceOverridden: manualPrice !== null,
    }
  }
  const fee = s.raas?.monthlyFeePerRobotRub ?? robot.raasMonthlyPrice
  if (fee == null) {
    throw new MockFail(422, 'CALCULATION_ERROR',
      `У «${robot.name}» нет цены аренды (RaaS) — укажите ежемесячную плату за робота`)
  }
  const setup = s.raas?.setupRub ?? MOCK_CONST.raasSetupRub
  const equipment = [line('Внедрение, интеграция и подготовка площадки (RaaS)', 1, setup)]
  return {
    econ: economics(inputs, count, setup, raasRobotOpex(count, Math.round(fee * f.price), a)),
    equipment, countOverridden: manualCount !== null, priceOverridden: false,
  }
}

function verdictOf(s: ScenarioInput, e: Economics, robot: Robot | null, horizon: number): Verdict {
  if (s.kind === 'baseline') {
    return { level: 'moderate', label: 'Текущее состояние', interpretation: 'Процессы выполняет персонал, инвестиций нет. Сценарий — точка отсчёта для сравнения.', risks: ['Рост фонда оплаты труда', 'Нехватка персонала в пиковые периоды'] }
  }
  const risks: string[] = []
  if (robot && !robot.confirmed) risks.push('Характеристики робота не подтверждены источником')
  if (s.kind === 'raas' && s.raas && s.raas.contractYears < horizon) risks.push('Срок договора аренды короче горизонта расчёта — условия продления могут измениться')
  if (s.kind === 'purchase') risks.push('Стоимость интеграции с WMS может отличаться после обследования')
  const p = e.paybackYears
  if (p === null) return { level: 'negative', label: 'Не окупается', interpretation: 'Экономия на персонале не покрывает расходы на роботов.', risks }
  if (p > horizon) risks.push('Окупаемость дольше горизонта расчёта')
  if (p < 3) return { level: 'good', label: 'Окупается быстро', interpretation: 'Срок окупаемости до 3 лет — проект привлекателен для пилотного внедрения.', risks }
  if (p <= 5) return { level: 'moderate', label: 'Умеренная окупаемость', interpretation: 'Срок окупаемости 3–5 лет — решение стоит принимать с учётом стратегии развития объекта.', risks }
  return { level: 'poor', label: 'Долгая окупаемость', interpretation: 'Срок окупаемости более 5 лет — рассмотрите аренду или другой тип робота.', risks }
}

function cashflow(e: Economics, horizon: number): CashflowYear[] {
  const years: CashflowYear[] = [{ year: 0, capexRub: e.capexRub, opexRub: 0, effectRub: 0, cumulativeRub: -e.capexRub }]
  let cumulative = -e.capexRub
  for (let year = 1; year <= horizon; year++) {
    cumulative += e.annualEffectRub
    years.push({ year, capexRub: 0, opexRub: e.opexAnnualRub, effectRub: e.annualEffectRub, cumulativeRub: cumulative })
  }
  return years
}

function metric(label: string, value: number | null, unit: string, formula: string, extra: Partial<Metric> = {}): Metric {
  return { label, value, unit, formula, overridden: false, ...extra }
}

function metrics(c: Computed, inputs: ModelInputs): Record<MetricKey, Metric> {
  const e = c.econ
  const a = inputs.assumptions
  return {
    robotCount: metric('Количество роботов', e.robotCount, 'шт.',
      '⌈Целевая производительность / (Производительность робота × Загрузка × Готовность)⌉ × (1 + Резерв)',
      { overridden: c.countOverridden, inputs: { targetPerHour: Math.round(inputs.targetPerHour), utilization: a.utilization, availability: a.availability, reserveShare: a.reserveShare } }),
    capexRub: metric('Капитальные затраты', e.capexRub, '₽', 'Сумма строк спецификации оборудования и работ',
      { overridden: c.priceOverridden, breakdown: c.equipment.map((l, i) => ({ key: `line${i + 1}`, label: l.item, value: l.totalRub })) }),
    opexAnnualRub: metric('Операционные затраты в год', e.opexAnnualRub, '₽/год', 'ФОТ оставшегося персонала + обслуживание, энергия и ПО роботов',
      { breakdown: [
        { key: 'labor', label: 'ФОТ оставшегося персонала', value: e.laborBaseRub - e.laborSavingRub, source: 'Параметры объекта' },
        { key: 'robots', label: 'Обслуживание, аренда, энергия, ПО', value: e.robotOpexRub, source: 'Каталог роботов' },
      ] }),
    opexDeltaRub: metric('Изменение операционных затрат', e.opexDeltaRub, '₽/год', 'OPEX сценария − OPEX текущего состояния'),
    annualEffectRub: metric('Годовой эффект', e.annualEffectRub, '₽/год', 'Экономия ФОТ − расходы на роботов',
      { inputs: { replacedStaff: e.replacedStaff, laborSavingRub: e.laborSavingRub, robotOpexRub: e.robotOpexRub } }),
    paybackYears: metric('Срок окупаемости', e.paybackYears, 'лет', 'Капитальные затраты / Годовой эффект'),
    roiPercent: metric('ROI за горизонт расчёта', e.roiPercent, '%', '(Годовой эффект × Горизонт − Капзатраты) / Капзатраты × 100 %',
      { inputs: { horizonYears: a.horizonYears } }),
    tcoRub: metric('Совокупная стоимость владения', e.tcoRub, '₽', 'Капзатраты + OPEX × Горизонт расчёта', { inputs: { horizonYears: a.horizonYears } }),
  }
}

const SENS_LABELS: Record<SensParam, string> = {
  equipmentPrice: 'Стоимость оборудования',
  operationsVolume: 'Объём операций',
  laborCost: 'Стоимость труда',
}

function factorsFor(param: SensParam, delta: number): Factors {
  if (param === 'equipmentPrice') return { ...NO_FACTORS, price: 1 + delta }
  if (param === 'operationsVolume') return { ...NO_FACTORS, volume: 1 + delta }
  return { ...NO_FACTORS, labor: 1 + delta }
}

function assumptionsUsed(inputs: ModelInputs): AssumptionRef[] {
  const a = inputs.assumptions
  const pct = (v: number) => Math.round(v * 1000) / 10
  return [
    { key: 'horizonYears', label: 'Горизонт расчёта', value: a.horizonYears, unit: 'лет', source: 'Параметры проекта', confirmed: true },
    { key: 'workDaysPerYear', label: 'Рабочих дней в году', value: a.workDaysPerYear, unit: 'дн.', source: 'Производственный календарь РФ', confirmed: true },
    { key: 'shiftsPerDay', label: 'Смен в сутки', value: a.shiftsPerDay, unit: 'смен', source: 'Параметры проекта', confirmed: true },
    { key: 'hoursPerShift', label: 'Длительность смены', value: a.hoursPerShift, unit: 'ч', source: 'ТК РФ, ст. 91', confirmed: true },
    { key: 'utilization', label: 'Загрузка робота', value: pct(a.utilization), unit: '%', source: 'Демо-оценка по отраслевой практике', confirmed: false },
    { key: 'availability', label: 'Техническая готовность', value: pct(a.availability), unit: '%', source: 'Демо-оценка по данным производителей', confirmed: false },
    { key: 'reserveShare', label: 'Резерв парка', value: pct(a.reserveShare), unit: '%', source: 'Демо-оценка', confirmed: false },
    { key: 'staffReplacedShare', label: 'Доля замещаемого персонала', value: pct(a.staffReplacedShare), unit: '%', source: 'Демо-оценка', confirmed: false },
    { key: 'staffCostMonthRub', label: 'Стоимость сотрудника', value: Math.round(inputs.staffCostMonthRub), unit: '₽/мес', source: 'Параметры объекта', confirmed: true },
    { key: 'energyTariffRub', label: 'Тариф на электроэнергию', value: MOCK_CONST.energyTariffRub, unit: '₽/кВт·ч', source: 'Демо-оценка', confirmed: false },
    { key: 'integrationRub', label: 'Интеграция с WMS', value: MOCK_CONST.integrationRub, unit: '₽', source: 'Демо-оценка по рынку', confirmed: false },
  ]
}

export function buildCalcResult(req: CalcRequest, catalog: Robot[], calculationId: string | null): CalcResult {
  const inputs = readInputs(req.params, req.assumptions)
  const horizon = req.assumptions.horizonYears
  const inputsList: ScenarioInput[] = req.scenarios.length
    ? req.scenarios
    : [{ id: 'baseline', kind: 'baseline', title: 'Текущее состояние', robotId: null }]
  const robotOf = (s: ScenarioInput) => catalog.find((r) => r.id === s.robotId) ?? null

  const scenarios: ScenarioResult[] = inputsList.map((s) => {
    const robot = robotOf(s)
    const c = computeScenario(s, robot, inputs, NO_FACTORS)
    return {
      id: s.id, kind: s.kind, title: s.title, robotId: s.robotId,
      equipment: c.equipment, metrics: metrics(c, inputs), cashflow: cashflow(c.econ, horizon),
      verdict: verdictOf(s, c.econ, robot, horizon),
    }
  })

  const sensitivity: SensitivitySeries[] = []
  for (const s of inputsList.filter((x) => x.kind !== 'baseline')) {
    for (const param of req.sensitivity.params) {
      sensitivity.push({
        scenarioId: s.id, param, label: SENS_LABELS[param],
        points: req.sensitivity.deltas.map((delta) => {
          const { econ } = computeScenario(s, robotOf(s), inputs, factorsFor(param, delta))
          return { delta, paybackYears: econ.paybackYears, roiPercent: econ.roiPercent, annualEffectRub: econ.annualEffectRub }
        }),
      })
    }
  }

  return {
    calculationId,
    modelVersion: MODEL_VERSION,
    dataVersion: DATA_VERSION,
    calculatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    recommendation: buildRecommendation(catalog, req.objectType, req.processes, req.params, inputs),
    scenarios,
    sensitivity,
    assumptionsUsed: assumptionsUsed(inputs),
  }
}

export function bestPayback(result: CalcResult): number | null {
  const values = result.scenarios
    .map((s) => s.metrics.paybackYears.value)
    .filter((v): v is number => v !== null)
  return values.length ? Math.min(...values) : null
}
