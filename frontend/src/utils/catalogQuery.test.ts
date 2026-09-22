import { describe, expect, it } from 'vitest'
import { filtersFromQuery, filtersToQuery, filtersToRequest, hasActiveFilters } from './catalogQuery'

describe('filtersFromQuery', () => {
  it('читает параметры и обрезает пробелы', () => {
    expect(filtersFromQuery({ q: ' лог ', objectType: 'warehouse', solutionType: 'amr', sort: '-price' })).toEqual({
      q: 'лог', objectType: 'warehouse', solutionType: 'amr', sort: '-price',
    })
  })
  it('берёт первое значение из повторяющегося параметра', () => {
    expect(filtersFromQuery({ objectType: ['airport', 'warehouse'] }).objectType).toBe('airport')
  })
  it('отбрасывает неизвестную сортировку и пустые значения', () => {
    expect(filtersFromQuery({ sort: 'DROP', q: null })).toEqual({ q: '', objectType: '', solutionType: '', sort: 'name' })
  })
})

describe('filtersToQuery', () => {
  it('не кладёт пустые значения в URL', () => {
    expect(filtersToQuery({ q: '  ', objectType: 'warehouse', solutionType: '', sort: 'name' })).toEqual({ objectType: 'warehouse' })
  })
  it('туда и обратно без потерь', () => {
    const f = { q: 'тягач', objectType: 'airport', solutionType: 'tugger', sort: 'price' as const }
    expect(filtersFromQuery(filtersToQuery(f))).toEqual(f)
  })
})

describe('filtersToRequest', () => {
  it('сортировка по умолчанию не пишется в URL, но уходит в запрос', () => {
    expect(filtersToQuery({ q: '', objectType: '', solutionType: '', sort: 'name' })).toEqual({})
    expect(filtersToRequest({ q: '', objectType: '', solutionType: '', sort: 'name' })).toEqual({ sort: 'name' })
    expect(filtersToRequest({ q: 'a', objectType: '', solutionType: '', sort: '-perfOpsPerHour' })).toEqual({ q: 'a', sort: '-perfOpsPerHour' })
  })
})

describe('hasActiveFilters', () => {
  it('сортировка фильтром не считается', () => {
    expect(hasActiveFilters({ q: '', objectType: '', solutionType: '', sort: 'price' })).toBe(false)
    expect(hasActiveFilters({ q: 'x', objectType: '', solutionType: '', sort: 'name' })).toBe(true)
  })
})
