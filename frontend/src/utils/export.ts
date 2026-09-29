// Выгрузки, которые формируются в браузере: CSV со сравнением сценариев, имена файлов,
// список роботов сценариев. Числа берутся из ответа сервера как есть — здесь только формат.
import type { CalcResult, MetricKey, ScenarioInput } from '@/types/api'
import { formatDate } from './format'

/** Порядок показателей в таблице сравнения сценариев. */
export const EXPORT_METRICS: readonly MetricKey[] = [
  'robotCount',
  'capexRub',
  'opexAnnualRub',
  'opexDeltaRub',
  'annualEffectRub',
  'paybackYears',
  'roiPercent',
  'tcoRub',
]

const BOM = '﻿'
const SEP = ';'
const EOL = '\r\n'

/**
 * Число для CSV под русскую локаль Excel: запятая как десятичный разделитель,
 * без разделителей разрядов (иначе Excel не распознает число), до 2 знаков.
 */
export function csvNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  const rounded = Math.round(value * 100) / 100 || 0
  return String(rounded).replace('.', ',')
}

/** Ячейка CSV: кавычки, если внутри разделитель, кавычка или перенос строки. */
export function csvCell(value: string | number | null | undefined): string {
  const text = typeof value === 'number' ? csvNumber(value) : (value ?? '')
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(SEP)
}

/**
 * Таблица сравнения сценариев для Excel: разделитель «;», UTF-8 с BOM (иначе Excel
 * покажет кириллицу «кракозябрами»), строки — показатели, столбцы — сценарии.
 */
export function scenariosCsv(
  result: CalcResult,
  info: { objectName: string; robotName: (robotId: string) => string | null },
): string {
  const scenarios = result.scenarios
  const first = scenarios[0]
  const lines: string[] = [
    row(['Сравнение сценариев роботизации']),
    row(['Объект', info.objectName]),
    row(['Дата расчёта', formatDate(result.calculatedAt, true)]),
    row(['Версия модели', result.modelVersion]),
    row(['Версия данных', result.dataVersion]),
    '',
    row(['Показатель', 'Единица', ...scenarios.map((s) => s.title)]),
    row(['Робот', '', ...scenarios.map((s) => (s.robotId ? (info.robotName(s.robotId) ?? s.robotId) : 'Без роботов'))]),
  ]
  if (first) {
    for (const key of EXPORT_METRICS) {
      const sample = first.metrics[key]
      if (!sample) continue
      lines.push(row([sample.label, sample.unit, ...scenarios.map((s) => s.metrics[key]?.value ?? null)]))
    }
  }
  lines.push(row(['Вывод', '', ...scenarios.map((s) => s.verdict.label)]))
  lines.push('', row([result.disclaimer]))
  return BOM + lines.join(EOL) + EOL
}

/** Имя файла выгрузки: «robo-scenarios-2026-09-23.csv». Дата — по времени пользователя. */
export function exportFileName(prefix: string, ext: string, date: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0')
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
  return `${prefix}-${day}.${ext}`
}

export interface UsedRobot {
  robotId: string
  name: string
  /** Названия сценариев, где выбран робот. */
  scenarios: string[]
}

/** Роботы, выбранные в сценариях, в порядке первого появления. */
export function usedRobots(
  scenarios: readonly Pick<ScenarioInput, 'robotId' | 'title'>[],
  robotName: (robotId: string) => string | null,
): UsedRobot[] {
  const list: UsedRobot[] = []
  for (const s of scenarios) {
    if (!s.robotId) continue
    const item = list.find((r) => r.robotId === s.robotId)
    if (item) item.scenarios.push(s.title)
    else list.push({ robotId: s.robotId, name: robotName(s.robotId) ?? s.robotId, scenarios: [s.title] })
  }
  return list
}
