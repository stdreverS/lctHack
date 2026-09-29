// Проверка параметров объекта по описанию полей (ObjectType.fields).
// Сообщения — на русском и подсказывают, как исправить.
import type { ParamField, ParamValue, Params } from '@/types/api'
import { formatNumber } from './format'

export interface ParamIssue {
  key: string
  label: string
  message: string
}

type Value = ParamValue | undefined

export function isEmptyValue(value: Value): value is null | undefined | '' {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function withUnit(value: number, field: ParamField): string {
  return field.unit ? `${formatNumber(value)}\u00A0${field.unit}` : formatNumber(value)
}

function exampleText(field: ParamField): string {
  const ex = field.example ?? field.default
  if (ex === null || ex === undefined || typeof ex === 'boolean') return ''
  if (typeof ex === 'number') return `, например ${withUnit(ex, field)}`
  const option = field.options?.find((o) => o.value === ex)
  return `, например «${option?.label ?? ex}»`
}

/** Ошибка одного поля или null, если значение допустимо. */
export function validateField(field: ParamField, value: Value): string | null {
  if (isEmptyValue(value)) {
    if (!field.required) return null
    if (field.type === 'enum') return 'Выберите значение из списка'
    if (field.type === 'boolean') return 'Выберите «Да» или «Нет»'
    return `Заполните поле${exampleText(field)}`
  }

  switch (field.type) {
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `Введите число${exampleText(field)}`
      if (field.type === 'integer' && !Number.isInteger(value)) {
        return `Введите целое число без дробной части${exampleText(field)}`
      }
      if (field.min !== undefined && value < field.min) {
        return `Слишком маленькое значение: минимум ${withUnit(field.min, field)}. Увеличьте значение`
      }
      if (field.max !== undefined && value > field.max) {
        return `Слишком большое значение: максимум ${withUnit(field.max, field)}. Уменьшите значение`
      }
      return null
    }
    case 'enum': {
      const options = field.options ?? []
      if (typeof value === 'string' && options.some((o) => o.value === value)) return null
      return `Выберите значение из списка: ${options.map((o) => o.label).join('; ')}`
    }
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Выберите «Да» или «Нет»'
    case 'string':
      return typeof value === 'string' ? null : 'Введите текст'
  }
}

/** Все ошибки формы в порядке полей. */
export function validateParams(fields: readonly ParamField[], params: Params): ParamIssue[] {
  const issues: ParamIssue[] = []
  for (const field of fields) {
    const message = validateField(field, params[field.key])
    if (message) issues.push({ key: field.key, label: field.label, message })
  }
  return issues
}
