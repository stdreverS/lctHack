// Форматирование значений для интерфейса (ru-RU).
// Разделитель разрядов и пробел перед знаком — неразрывный пробел (U+00A0),
// чтобы «12 400 000 ₽» не разрывалось при переносе строки.

const NBSP = '\u00A0'
const EMPTY = '—'

type Maybe<T> = T | null | undefined

function isValidNumber(value: Maybe<number>): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toRu(value: number, minDigits: number, maxDigits: number): string {
  const factor = 10 ** maxDigits
  const rounded = Math.round(value * factor) / factor || 0 // без «-0» после округления
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  })
    .format(rounded)
    .replace(/[\s\u202F]/g, NBSP)
    .replace('\u2212', '-')
}

/** 1234567.891 → «1 234 567,89». По умолчанию до 2 знаков после запятой. */
export function formatNumber(value: Maybe<number>, maxFractionDigits = 2): string {
  if (!isValidNumber(value)) return EMPTY
  return toRu(value, 0, maxFractionDigits)
}

/** 12400000 → «12 400 000 ₽». Рубли округляются до целых. */
export function formatRub(value: Maybe<number>): string {
  if (!isValidNumber(value)) return EMPTY
  return `${toRu(Math.round(value), 0, 0)}${NBSP}₽`
}

/** Значение уже в процентах: 31.5 → «31,5 %». По умолчанию 1 знак после запятой. */
export function formatPercent(value: Maybe<number>, maxFractionDigits = 1): string {
  if (!isValidNumber(value)) return EMPTY
  return `${toRu(value, 0, maxFractionDigits)}${NBSP}%`
}

/** Слово «год» в нужной форме: 1 год, 2 года, 5 лет, 21 год; дробные — «года». */
export function pluralYears(value: number): string {
  if (!Number.isInteger(value)) return 'года'
  const n = Math.abs(value)
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'год'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'года'
  return 'лет'
}

/** 2.4 → «2,4 года», 1 → «1 год», 5 → «5 лет». По умолчанию 1 знак после запятой. */
export function formatYears(value: Maybe<number>, maxFractionDigits = 1): string {
  if (!isValidNumber(value)) return EMPTY
  // Склонение — по округлённому значению, которое видит пользователь (0,96 → «1 год»).
  const factor = 10 ** maxFractionDigits
  const rounded = Math.round(value * factor) / factor
  return `${toRu(rounded, 0, maxFractionDigits)}${NBSP}${pluralYears(rounded)}`
}

/** ISO 8601 → «22.09.2026» или «22.09.2026, 14:05» (в часовом поясе пользователя). */
export function formatDate(value: Maybe<string | Date>, withTime = false): string {
  if (value === null || value === undefined || value === '') return EMPTY
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return EMPTY
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}
