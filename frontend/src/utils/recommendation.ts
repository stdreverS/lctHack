// Отображение результатов подбора и сценариев мастера. Статусы и баллы считает сервер —
// здесь только группировка, сортировка и тексты.
import type { Check, RecStatus, RecommendationItem, ScenarioInput, ScenarioKind } from '@/types/api'
import { formatNumber } from './format'
import { NO_DATA } from './robotSpecs'

/** Сколько роботов можно выбрать для сравнения. */
export const MAX_COMPARE = 3

export const STATUS_LABELS: Record<RecStatus, string> = {
  recommended: 'Рекомендовано',
  needs_check: 'Требует проверки',
  excluded: 'Не подходит',
}

export interface RecGroup {
  status: RecStatus
  label: string
  items: RecommendationItem[]
}

const GROUP_ORDER: RecStatus[] = ['recommended', 'needs_check', 'excluded']

/** Три группы в порядке «Рекомендовано → Требует проверки → Не подходит», внутри — по убыванию балла. */
export function groupRecommendations(items: readonly RecommendationItem[]): RecGroup[] {
  return GROUP_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    items: items
      .filter((i) => i.status === status)
      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.name.localeCompare(b.name, 'ru')),
  }))
}

function checkValue(value: number | string | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return NO_DATA
  const text = typeof value === 'number' ? formatNumber(value) : value
  return unit ? `${text} ${unit}` : text
}

/** «требуется 350 кг, у робота 600 кг»; если сравнивать нечего — пустая строка. */
export function checkValues(check: Pick<Check, 'required' | 'actual' | 'unit'>): string {
  const hasRequired = check.required !== null && check.required !== undefined && check.required !== ''
  const hasActual = check.actual !== null && check.actual !== undefined && check.actual !== ''
  if (!hasRequired && !hasActual) return ''
  return `требуется ${checkValue(check.required, check.unit)}, у робота ${checkValue(check.actual, check.unit)}`
}

/** Критические проверки, которые робот не прошёл, — для предупреждения при ручном добавлении. */
export function failedCritical(item: Pick<RecommendationItem, 'checks'>): Check[] {
  return item.checks.filter((c) => c.critical && c.result === 'fail')
}

/** Ширина полос ScoreBreakdown в процентах: 100 % — наибольший возможный вклад (вес × 100). */
export function contributionBars(factors: readonly { weight: number; contribution: number }[]) {
  const maxPossible = Math.max(0, ...factors.map((f) => f.weight * 100))
  const pct = (v: number) => (maxPossible > 0 ? Math.min(100, Math.max(0, (v / maxPossible) * 100)) : 0)
  return factors.map((f) => ({ track: pct(f.weight * 100), fill: pct(f.contribution) }))
}

// ---------- Сценарии ----------

type RobotScenarioKind = Exclude<ScenarioKind, 'baseline'>

export const SCENARIO_TITLES: Record<ScenarioKind, string> = {
  baseline: 'Текущее состояние',
  purchase: 'Покупка',
  raas: 'Роботы как услуга (RaaS)',
}

const KIND_ORDER: ScenarioKind[] = ['baseline', 'purchase', 'raas']

export function scenarioRobotId(scenarios: readonly ScenarioInput[], kind: RobotScenarioKind): string | null {
  return scenarios.find((s) => s.kind === kind)?.robotId ?? null
}

/**
 * Назначает робота сценарию «Покупка» или «RaaS»; null — убирает сценарий.
 * Сценарий «Текущее состояние» добавляется всегда. Ручные правки сценария сохраняются,
 * только если робот не сменился.
 */
export function withScenarioRobot(
  scenarios: readonly ScenarioInput[],
  kind: RobotScenarioKind,
  robotId: string | null,
): ScenarioInput[] {
  const others = scenarios.filter((s) => s.kind !== kind && s.kind !== 'baseline')
  const prev = scenarios.find((s) => s.kind === kind)
  const list: ScenarioInput[] = [
    scenarios.find((s) => s.kind === 'baseline') ?? { id: 'baseline', kind: 'baseline', title: SCENARIO_TITLES.baseline, robotId: null },
    ...others,
  ]
  if (robotId !== null) {
    list.push(prev && prev.robotId === robotId ? prev : { id: kind, kind, title: SCENARIO_TITLES[kind], robotId })
  }
  return list.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}

/** Условия RaaS по умолчанию: плата — из каталога, договор 3 года, внедрение 1,5 млн ₽. Пользователь их правит. */
export const RAAS_DEFAULT_TERMS = { contractYears: 3, setupRub: 1_500_000 } as const

/** Меняет поля сценария указанного вида; остальные сценарии не трогает. */
export function patchScenario(
  scenarios: readonly ScenarioInput[],
  kind: ScenarioKind,
  patch: Partial<Omit<ScenarioInput, 'id' | 'kind'>>,
): ScenarioInput[] {
  return scenarios.map((s) => (s.kind === kind ? { ...s, ...patch } : s))
}
