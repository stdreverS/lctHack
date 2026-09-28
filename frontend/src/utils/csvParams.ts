// CSV параметров объекта: шаблон (генерируется из ObjectType.fields) и импорт с отчётом.
// Формат: столбцы key;label;unit;value, по строке на поле. Разделитель при импорте — «;» или «,».
import Papa from 'papaparse'
import type { ParamField, ParamValue, Params } from '@/types/api'
import { validateField } from './validateParams'

export const CSV_COLUMNS = ['key', 'label', 'unit', 'value'] as const
/** BOM — чтобы Excel открыл UTF-8 с кириллицей без «кракозябр». */
const BOM = '﻿'

function templateValue(field: ParamField): string {
  const value = field.example ?? field.default
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  // Десятичная запятая — как в русском Excel; разделитель столбцов «;» с ней не конфликтует.
  if (typeof value === 'number') return String(value).replace('.', ',')
  return value
}

/** Текст шаблона CSV (с BOM) для заполнения в Excel. */
export function buildCsvTemplate(fields: readonly ParamField[]): string {
  const rows = fields.map((f) => [f.key, f.label, f.unit ?? '', templateValue(f)])
  return BOM + Papa.unparse({ fields: [...CSV_COLUMNS], data: rows }, { delimiter: ';', newline: '\r\n' })
}

export interface CsvInvalidValue {
  key: string
  label: string
  raw: string
  message: string
}

export interface CsvImportReport {
  /** Распознанные и прошедшие проверку значения — их можно подставить в форму. */
  params: Params
  /** Ключи заполненных полей в порядке файла. */
  filled: string[]
  /** Ключи из файла, которых нет среди полей типа объекта. */
  unknownKeys: string[]
  /** Значения, не прошедшие проверку (в форму не подставляются). */
  invalid: CsvInvalidValue[]
  /** Ошибка разбора файла целиком (пустой файл, нет столбцов key/value). */
  fileError: string | null
}

const TRUE_WORDS = ['да', 'true', '1', 'yes', 'y', 'д']
const FALSE_WORDS = ['нет', 'false', '0', 'no', 'n', 'н']

/** «12 000,5» → 12000.5; не число → null. */
export function parseCsvNumber(raw: string): number | null {
  const text = raw.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return null
  return Number(text)
}

/** Приводит текст ячейки к типу поля. Строка ошибки — если привести нельзя. */
function coerce(field: ParamField, raw: string): { value: ParamValue } | { error: string } {
  switch (field.type) {
    case 'number':
    case 'integer': {
      const n = parseCsvNumber(raw)
      return n === null ? { error: 'Ожидается число, например 1200 или 1,5' } : { value: n }
    }
    case 'boolean': {
      const word = raw.toLowerCase()
      if (TRUE_WORDS.includes(word)) return { value: true }
      if (FALSE_WORDS.includes(word)) return { value: false }
      return { error: 'Ожидается «да» или «нет»' }
    }
    case 'enum': {
      const word = raw.toLowerCase()
      const option = field.options?.find((o) => o.value.toLowerCase() === word || o.label.toLowerCase() === word)
      if (option) return { value: option.value }
      const allowed = (field.options ?? []).map((o) => o.value).join(', ')
      return { error: `Недопустимое значение. Укажите одно из: ${allowed}` }
    }
    case 'string':
      return { value: raw }
  }
}

function emptyReport(fileError: string | null): CsvImportReport {
  return { params: {}, filled: [], unknownKeys: [], invalid: [], fileError }
}

/**
 * Разбирает CSV и сопоставляет строки с полями по key.
 * Первая строка — заголовок со столбцами key и value (label и unit необязательны).
 * Без заголовка: первый столбец — key, последний — value.
 * Пустые значения пропускаются: поле в форме не меняется.
 */
export function parseParamsCsv(text: string, fields: readonly ParamField[]): CsvImportReport {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    delimitersToGuess: [';', ','],
    skipEmptyLines: 'greedy',
  })
  const rows = parsed.data.map((row) => row.map((cell) => cell.trim()))
  if (rows.length === 0) return emptyReport('Файл пустой. Скачайте шаблон CSV и заполните столбец value.')

  const header = rows[0]!.map((cell) => cell.toLowerCase())
  let keyCol = header.indexOf('key')
  let valueCol = header.indexOf('value')
  let dataRows = rows.slice(1)
  if (keyCol < 0 || valueCol < 0) {
    if (rows[0]!.length < 2) {
      return emptyReport('Не найдены столбцы key и value. Используйте шаблон CSV: key;label;unit;value.')
    }
    keyCol = 0
    valueCol = -1 // последний столбец строки
    dataRows = rows
  }

  const byKey = new Map(fields.map((f) => [f.key, f]))
  const report = emptyReport(null)
  const seen = new Set<string>()

  for (const row of dataRows) {
    const key = row[keyCol] ?? ''
    if (!key) continue
    const raw = (valueCol < 0 ? row[row.length - 1] : row[valueCol]) ?? ''
    const field = byKey.get(key)
    if (!field) {
      if (!report.unknownKeys.includes(key)) report.unknownKeys.push(key)
      continue
    }
    // Повтор ключа — действует последняя строка.
    if (seen.has(key)) {
      delete report.params[key]
      report.filled = report.filled.filter((k) => k !== key)
      report.invalid = report.invalid.filter((i) => i.key !== key)
    }
    seen.add(key)
    if (raw === '') continue

    const result = coerce(field, raw)
    const message = 'error' in result ? result.error : validateField(field, result.value)
    if (message || 'error' in result) {
      report.invalid.push({ key, label: field.label, raw, message: message ?? '' })
      continue
    }
    report.params[key] = result.value
    report.filled.push(key)
  }

  if (dataRows.length === 0) report.fileError = 'В файле нет строк с параметрами. Заполните столбец value в шаблоне.'
  return report
}
