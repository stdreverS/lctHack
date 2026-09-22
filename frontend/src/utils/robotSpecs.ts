// Характеристики робота по группам ТЗ: подписи, единицы и форматирование.
// Используются в карточке робота и в таблице сравнения каталога.
import type { Robot } from '@/types/api'
import { formatDate, formatNumber, formatRub, formatYears } from './format'

export const NO_DATA = 'нет данных'

const NBSP = ' '

export interface SpecContext {
  /** Названия типов объектов по коду: { warehouse: 'Склад' }. */
  objectTypeNames: Record<string, string>
}

export interface SpecRow {
  key: string
  label: string
  value: (robot: Robot, ctx: SpecContext) => string
}

export interface SpecGroup {
  key: string
  label: string
  rows: SpecRow[]
}

type Maybe<T> = T | null | undefined

function hasNumber(value: Maybe<number>): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function text(value: Maybe<string>): string {
  return value && value.trim() ? value.trim() : NO_DATA
}

/** 1.5, 'м/с' → «1,5 м/с»; нет значения → «нет данных». */
export function withUnit(value: Maybe<number>, unit: string, maxFractionDigits = 2): string {
  return hasNumber(value) ? `${formatNumber(value, maxFractionDigits)}${NBSP}${unit}` : NO_DATA
}

export function rubOrNoData(value: Maybe<number>): string {
  return hasNumber(value) ? formatRub(value) : NO_DATA
}

function yearsOrNoData(value: Maybe<number>): string {
  return hasNumber(value) ? formatYears(value) : NO_DATA
}

function dateOrNoData(value: Maybe<string>): string {
  const formatted = formatDate(value)
  return formatted === '—' ? NO_DATA : formatted
}

/** Габариты Ш × Д × В; неизвестные измерения — «?». */
function dimensions(r: Robot): string {
  const { widthM, lengthM, heightM } = r.specs
  const parts = [widthM, lengthM, heightM]
  if (!parts.some(hasNumber)) return NO_DATA
  return `${parts.map((v) => (hasNumber(v) ? formatNumber(v) : '?')).join(' × ')}${NBSP}м`
}

export function dataStatusLabel(confirmed: boolean): string {
  return confirmed ? 'Подтверждено' : 'Допущение'
}

export const ROBOT_SPEC_GROUPS: SpecGroup[] = [
  {
    key: 'identification',
    label: 'Идентификация',
    rows: [
      { key: 'name', label: 'Название', value: (r) => text(r.name) },
      { key: 'manufacturer', label: 'Производитель', value: (r) => text(r.manufacturer) },
      { key: 'solutionType', label: 'Тип решения', value: (r) => text(r.solutionTypeName) },
      { key: 'country', label: 'Страна производства', value: (r) => text(r.country) },
    ],
  },
  {
    key: 'technical',
    label: 'Технические характеристики',
    rows: [
      { key: 'payloadKg', label: 'Грузоподъёмность', value: (r) => withUnit(r.specs.payloadKg, 'кг') },
      { key: 'speedMps', label: 'Скорость', value: (r) => withUnit(r.specs.speedMps, 'м/с') },
      { key: 'perfOpsPerHour', label: 'Производительность', value: (r) => withUnit(r.specs.perfOpsPerHour, 'опер./ч') },
      { key: 'autonomyH', label: 'Автономность', value: (r) => withUnit(r.specs.autonomyH, 'ч') },
      { key: 'chargeTimeH', label: 'Время зарядки', value: (r) => withUnit(r.specs.chargeTimeH, 'ч') },
      { key: 'positioningMm', label: 'Точность позиционирования', value: (r) => withUnit(r.specs.positioningMm, 'мм') },
      { key: 'navigation', label: 'Навигация', value: (r) => text(r.specs.navigation) },
    ],
  },
  {
    key: 'infrastructure',
    label: 'Требования к инфраструктуре',
    rows: [
      { key: 'minAisleM', label: 'Минимальная ширина прохода', value: (r) => withUnit(r.specs.minAisleM, 'м') },
      { key: 'dimensions', label: 'Габариты (Ш × Д × В)', value: dimensions },
    ],
  },
  {
    key: 'economics',
    label: 'Экономика',
    rows: [
      { key: 'price', label: 'Цена покупки', value: (r) => rubOrNoData(r.price) },
      { key: 'raasMonthlyPrice', label: 'Аренда (RaaS) в месяц', value: (r) => rubOrNoData(r.raasMonthlyPrice) },
      { key: 'maintenancePerYear', label: 'Обслуживание в год', value: (r) => rubOrNoData(r.maintenancePerYear) },
      { key: 'lifeYears', label: 'Срок службы', value: (r) => yearsOrNoData(r.specs.lifeYears) },
    ],
  },
  {
    key: 'applicability',
    label: 'Применимость',
    rows: [
      {
        key: 'objectTypes',
        label: 'Типы объектов',
        value: (r, ctx) =>
          r.objectTypes.length ? r.objectTypes.map((code) => ctx.objectTypeNames[code] ?? code).join(', ') : NO_DATA,
      },
      { key: 'availability', label: 'Доступность поставки', value: (r) => text(r.availability) },
    ],
  },
  {
    key: 'quality',
    label: 'Качество данных',
    rows: [
      { key: 'confirmed', label: 'Статус данных', value: (r) => dataStatusLabel(r.confirmed) },
      { key: 'sourceUrl', label: 'Источник', value: (r) => text(r.sourceUrl) },
      { key: 'sourceDate', label: 'Дата данных', value: (r) => dateOrNoData(r.sourceDate) },
    ],
  },
]

export interface ComparisonRow {
  key: string
  label: string
  /** Значения в порядке переданных роботов. */
  values: string[]
  differs: boolean
}

export interface ComparisonGroup {
  key: string
  label: string
  rows: ComparisonRow[]
}

/** Строки для таблицы сравнения; название робота — в заголовке столбца, поэтому исключено. */
export function buildComparison(robots: readonly Robot[], ctx: SpecContext): ComparisonGroup[] {
  return ROBOT_SPEC_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    rows: group.rows
      .filter((row) => row.key !== 'name')
      .map((row) => {
        const values = robots.map((r) => row.value(r, ctx))
        return { key: row.key, label: row.label, values, differs: new Set(values).size > 1 }
      }),
  }))
}
