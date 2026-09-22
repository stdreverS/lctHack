// Фильтры каталога ⇄ query-параметры URL (?q=&objectType=&solutionType=&sort=),
// чтобы выборкой можно было поделиться ссылкой. Сортировка по умолчанию (по названию) в URL не пишется.
import type { RobotListQuery } from '@/types/api'

export interface CatalogFilters {
  q: string
  objectType: string
  solutionType: string
  sort: CatalogSort
}

export type CatalogSort = 'name' | 'price' | '-price' | '-perfOpsPerHour' | 'perfOpsPerHour'

export const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'name', label: 'По названию' },
  { value: 'price', label: 'Сначала дешевле' },
  { value: '-price', label: 'Сначала дороже' },
  { value: '-perfOpsPerHour', label: 'Сначала производительнее' },
  { value: 'perfOpsPerHour', label: 'Сначала менее производительные' },
]

const DEFAULT_SORT: CatalogSort = 'name'

type RawQuery = Record<string, string | null | (string | null)[] | undefined>

function first(value: RawQuery[string]): string {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v.trim() : ''
}

function isSort(value: string): value is CatalogSort {
  return SORT_OPTIONS.some((o) => o.value === value)
}

/** route.query → фильтры; неизвестная сортировка отбрасывается. */
export function filtersFromQuery(query: RawQuery): CatalogFilters {
  const sort = first(query.sort)
  return {
    q: first(query.q),
    objectType: first(query.objectType),
    solutionType: first(query.solutionType),
    sort: isSort(sort) ? sort : DEFAULT_SORT,
  }
}

/** Фильтры → query для router.replace; пустые значения не попадают в URL. */
export function filtersToQuery(filters: CatalogFilters): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of ['q', 'objectType', 'solutionType'] as const) {
    const value = filters[key].trim()
    if (value) result[key] = value
  }
  if (filters.sort !== DEFAULT_SORT) result.sort = filters.sort
  return result
}

/** Фильтры → параметры запроса GET /robots (сортировка передаётся всегда). */
export function filtersToRequest(filters: CatalogFilters): RobotListQuery {
  return { ...filtersToQuery(filters), sort: filters.sort }
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Boolean(filters.q.trim() || filters.objectType || filters.solutionType)
}
