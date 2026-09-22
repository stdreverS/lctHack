import { describe, expect, it } from 'vitest'
import type { ParamField } from '@/types/api'
import { DEFAULT_ASSUMPTIONS, defaultParams, newProjectInput, paybackLevel } from './projects'

const fields: ParamField[] = [
  { key: 'areaM2', label: 'Площадь', group: 'object', type: 'number', required: true, default: 12000 },
  { key: 'workMode', label: 'Режим', group: 'object', type: 'enum', required: true, default: '2x8' },
  { key: 'hasBhs', label: 'BHS', group: 'object', type: 'boolean', required: true, default: false },
  { key: 'note', label: 'Комментарий', group: 'object', type: 'string', required: false },
]

describe('defaultParams', () => {
  it('берёт default каждого поля, без default — null', () => {
    expect(defaultParams({ fields })).toEqual({ areaM2: 12000, workMode: '2x8', hasBhs: false, note: null })
  })

  it('пустой список полей — пустые параметры', () => {
    expect(defaultParams({ fields: [] })).toEqual({})
  })
})

describe('newProjectInput', () => {
  it('обрезает пробелы в названии и копирует допущения', () => {
    const input = newProjectInput('  Склад Химки  ', { code: 'warehouse', fields })
    expect(input.name).toBe('Склад Химки')
    expect(input.objectType).toBe('warehouse')
    expect(input.params.areaM2).toBe(12000)
    expect(input.assumptions).toEqual(DEFAULT_ASSUMPTIONS)
    expect(input.assumptions).not.toBe(DEFAULT_ASSUMPTIONS)
  })
})

describe('paybackLevel', () => {
  it.each([
    [0.5, 'good'],
    [3, 'good'],
    [3.01, 'moderate'],
    [5, 'moderate'],
    [5.1, 'poor'],
    [null, 'none'],
    [undefined, 'none'],
    [Number.NaN, 'none'],
    [-1, 'none'],
  ] as const)('%s → %s', (years, level) => {
    expect(paybackLevel(years)).toBe(level)
  })
})
