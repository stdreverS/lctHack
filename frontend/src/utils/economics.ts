// Отображение результатов расчёта экономики. Все числа считает сервер — здесь только
// форматирование, выбор лучшего сценария по готовым значениям и подписи.
import type { AssumptionRef, Metric, ScenarioKind, ScenarioResult } from '@/types/api'
import { formatNumber, formatPercent, formatRub, formatYears } from './format'

const NBSP = ' '

/** Значение метрики по её единице: ₽, ₽/год, лет, %, прочие — число с единицей. */
export function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  switch (unit) {
    case '₽':
      return formatRub(value)
    case '₽/год':
      return `${formatRub(value)}/год`
    case 'лет':
    case 'года':
    case 'год':
      return formatYears(value)
    case '%':
      return formatPercent(value)
    default:
      return unit ? `${formatNumber(value)}${NBSP}${unit}` : formatNumber(value)
  }
}

/** Окупаемость: у сценария с роботами null означает «не окупается», у текущего состояния — прочерк. */
export function formatPayback(value: number | null | undefined, kind: ScenarioKind): string {
  if (typeof value === 'number' && Number.isFinite(value)) return formatYears(value)
  return kind === 'baseline' ? '—' : 'не окупается'
}

/** Сценарий с роботами и наименьшим сроком окупаемости; null — ни один не окупается. */
export function bestScenario(scenarios: readonly ScenarioResult[]): ScenarioResult | null {
  let best: ScenarioResult | null = null
  for (const s of scenarios) {
    const years = s.metrics.paybackYears.value
    if (s.kind === 'baseline' || years === null) continue
    if (!best || years < (best.metrics.paybackYears.value ?? Infinity)) best = s
  }
  return best
}

/** Подписи ключей Metric.inputs, которые не описаны в assumptionsUsed. */
const INPUT_LABELS: Record<string, string> = {
  targetPerHour: 'Целевая производительность, опер./ч',
  utilization: 'Загрузка робота (доля)',
  availability: 'Техническая готовность (доля)',
  reserveShare: 'Резерв парка (доля)',
  horizonYears: 'Горизонт расчёта, лет',
  replacedStaff: 'Замещаемый персонал, чел.',
  laborSavingRub: 'Экономия ФОТ, ₽/год',
  robotOpexRub: 'Расходы на роботов, ₽/год',
}

export interface InputRow {
  key: string
  label: string
  value: string
}

/** Строки «исходные данные» метрики; неизвестный ключ показывается как есть. */
export function metricInputs(metric: Pick<Metric, 'inputs'>, assumptions: readonly AssumptionRef[] = []): InputRow[] {
  return Object.entries(metric.inputs ?? {}).map(([key, value]) => ({
    key,
    label: INPUT_LABELS[key] ?? assumptions.find((a) => a.key === key)?.label ?? key,
    value: formatNumber(value),
  }))
}
