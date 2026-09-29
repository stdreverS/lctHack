// Печатный отчёт (п. 3.7.2 ТЗ): запрос расчёта для отчёта и строки таблиц.
// Числа считает сервер — здесь только сборка запроса и форматирование.
import type {
  Assumptions,
  CalcRequest,
  ObjectType,
  ParamField,
  ParamValue,
  Params,
  ScenarioInput,
  ScenarioResult,
  SensitivitySeries,
  SimKpi,
} from '@/types/api'
import { formatNumber, formatPercent, formatYears } from './format'
import { SENS_DELTAS, SENS_PARAMS } from './whatif'

const NBSP = ' '
const EMPTY = '—'

/** Запрос для отчёта: те же данные, что у мастера, плюс чувствительность. Не сохраняется в историю. */
export function reportRequest(state: {
  objectType: string
  processes: string[]
  params: Params
  assumptions: Assumptions
  scenarios: ScenarioInput[]
  simulation: SimKpi | null
}): CalcRequest {
  return {
    projectId: null,
    objectType: state.objectType,
    processes: [...state.processes],
    params: { ...state.params },
    assumptions: { ...state.assumptions },
    scenarios: state.scenarios,
    sensitivity: { params: SENS_PARAMS, deltas: SENS_DELTAS },
    simulation: state.simulation,
  }
}

/** Значение параметра объекта так, как его видит пользователь в форме. */
export function formatParamValue(field: ParamField, value: ParamValue | undefined): string {
  if (value === null || value === undefined || value === '') return EMPTY
  if (field.type === 'boolean') return value === true ? 'Да' : value === false ? 'Нет' : String(value)
  if (field.type === 'enum') return field.options?.find((o) => o.value === value)?.label ?? String(value)
  if (typeof value === 'number') return field.unit ? `${formatNumber(value)}${NBSP}${field.unit}` : formatNumber(value)
  return String(value)
}

export interface ReportParamRow {
  key: string
  label: string
  value: string
  /** Источник значения по умолчанию, если значение совпадает с ним. */
  source: string | null
}

export interface ReportParamGroup {
  key: string
  label: string
  rows: ReportParamRow[]
}

/** Параметры объекта по группам формы; пустые группы не выводятся. */
export function paramGroups(type: Pick<ObjectType, 'groups' | 'fields'>, params: Params): ReportParamGroup[] {
  return type.groups
    .map((g) => ({
      key: g.key,
      label: g.label,
      rows: type.fields
        .filter((f) => f.group === g.key)
        .map((f) => {
          const value = params[f.key]
          const fromDefault = f.defaultSource && value === f.default
          return {
            key: f.key,
            label: f.label,
            value: formatParamValue(f, value),
            source: fromDefault ? `${f.defaultSource!.source}${f.defaultSource!.confirmed ? '' : ' (допущение)'}` : null,
          }
        }),
    }))
    .filter((g) => g.rows.length > 0)
}

/** Подпись отклонения: −20 %, 0 %, +10 %. */
export function deltaLabel(delta: number): string {
  const pct = Math.round(delta * 100)
  if (pct === 0) return `0${NBSP}%`
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}${NBSP}%`
}

export interface SensitivityTable {
  scenarioId: string
  title: string
  deltas: number[]
  rows: { param: string; label: string; cells: string[] }[]
}

/**
 * Таблица чувствительности сценария: строки — параметры, столбцы — отклонения,
 * в ячейке — срок окупаемости (столбец 0 % — текущий результат сценария).
 */
export function sensitivityTables(scenarios: readonly ScenarioResult[], series: readonly SensitivitySeries[]): SensitivityTable[] {
  const tables: SensitivityTable[] = []
  for (const s of scenarios) {
    const own = series.filter((x) => x.scenarioId === s.id)
    if (!own.length) continue
    const deltas = [...new Set([0, ...own.flatMap((x) => x.points.map((p) => p.delta))])].sort((a, b) => a - b)
    const current = s.metrics.paybackYears.value
    tables.push({
      scenarioId: s.id,
      title: s.title,
      deltas,
      rows: own.map((x) => ({
        param: x.param,
        label: x.label,
        cells: deltas.map((d) => {
          const years = d === 0 ? current : (x.points.find((p) => p.delta === d)?.paybackYears ?? null)
          return years === null ? 'не окупается' : formatYears(years)
        }),
      })),
    })
  }
  return tables
}

/** Строки блока симуляции; null — симуляция в этой сессии не запускалась. */
export function simulationRows(kpi: SimKpi | null, scenarioTitle: string | null = null): { label: string; value: string }[] | null {
  if (!kpi) return null
  return [
    ...(scenarioTitle ? [{ label: 'Сценарий', value: scenarioTitle }] : []),
    { label: 'Целевая производительность', value: `${formatNumber(kpi.targetPerHour)}${NBSP}опер./ч` },
    { label: 'Выполнено в пиковый час', value: `${formatNumber(kpi.throughputPerHour)}${NBSP}опер./ч` },
    { label: 'Достигнуто от цели', value: formatPercent(kpi.achievedPercent) },
    { label: 'Средняя загрузка роботов', value: formatPercent(kpi.avgUtilization * 100) },
    { label: 'Наибольшая очередь заявок', value: formatNumber(kpi.maxQueue) },
    { label: 'Узкое место', value: kpi.bottleneck },
    { label: 'Вывод', value: kpi.confirmsCalculation ? 'Симуляция подтверждает расчёт' : 'Симуляция не подтверждает расчёт' },
    { label: 'Движок и зерно', value: `${kpi.engineVersion}, зерно ${kpi.seed}` },
  ]
}

/** Ограничения модели, которые должен знать читатель отчёта. */
export const REPORT_LIMITATIONS: readonly string[] = [
  'Предварительная оценка, требует верификации при обследовании объекта; решение о закупке — только после коммерческих предложений поставщиков.',
  'Характеристики и цены роботов взяты из каталога платформы; неподтверждённые данные отмечены в разделе «Выбранные решения».',
  'Финансирование — за счёт собственных средств; кредит, лизинг и амортизация в расчёте не учитываются.',
  'ТСО не учитывает замену основных компонентов в течение горизонта расчёта.',
  'Экономический эффект учитывает только экономию фонда оплаты труда; дополнительный доход и предотвращённые потери не оцениваются.',
  'Симуляция моделирует один пиковый час на условном плане объекта; порог подтверждения расчёта — 90 % целевой производительности.',
]
