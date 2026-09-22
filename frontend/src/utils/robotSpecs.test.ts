import { describe, expect, it } from 'vitest'
import type { Robot } from '@/types/api'
import { buildComparison, NO_DATA, ROBOT_SPEC_GROUPS, withUnit } from './robotSpecs'

const s = (text: string) => text.replace(/ /g, ' ')

const base: Robot = {
  id: 'r1', name: 'Робот 1', manufacturer: 'Завод', solutionType: 'amr', solutionTypeName: 'AMR',
  objectTypes: ['warehouse', 'unknown'], country: 'Россия', availability: null,
  price: 4_200_000, raasMonthlyPrice: null, maintenancePerYear: 320_000,
  specs: { payloadKg: 600, speedMps: 1.5, widthM: 0.95, lengthM: 1.3, heightM: null },
  sourceUrl: null, sourceDate: '2026-06-15', confirmed: true,
}

const ctx = { objectTypeNames: { warehouse: 'Склад' } }

function valueOf(robot: Robot, key: string): string {
  const row = ROBOT_SPEC_GROUPS.flatMap((g) => g.rows).find((r) => r.key === key)
  if (!row) throw new Error(`нет строки ${key}`)
  return row.value(robot, ctx)
}

describe('withUnit', () => {
  it('число с единицей через неразрывный пробел', () => {
    expect(withUnit(1.5, 'м/с')).toBe(s('1,5 м/с'))
    expect(withUnit(1500, 'кг')).toBe(s('1 500 кг'))
  })
  it('нет значения → «нет данных»', () => {
    expect(withUnit(null, 'кг')).toBe(NO_DATA)
    expect(withUnit(undefined, 'кг')).toBe(NO_DATA)
  })
})

describe('ROBOT_SPEC_GROUPS', () => {
  it('содержит все группы ТЗ', () => {
    expect(ROBOT_SPEC_GROUPS.map((g) => g.key)).toEqual([
      'identification', 'technical', 'infrastructure', 'economics', 'applicability', 'quality',
    ])
  })
  it('пустые значения — «нет данных», а не пустая строка', () => {
    expect(valueOf(base, 'availability')).toBe(NO_DATA)
    expect(valueOf(base, 'raasMonthlyPrice')).toBe(NO_DATA)
    expect(valueOf(base, 'perfOpsPerHour')).toBe(NO_DATA)
    expect(valueOf(base, 'navigation')).toBe(NO_DATA)
    expect(valueOf(base, 'sourceUrl')).toBe(NO_DATA)
    expect(valueOf({ ...base, country: '  ' }, 'country')).toBe(NO_DATA)
  })
  it('форматирует деньги, даты, габариты и типы объектов', () => {
    expect(valueOf(base, 'price')).toBe(s('4 200 000 ₽'))
    expect(valueOf(base, 'sourceDate')).toBe('15.06.2026')
    expect(valueOf(base, 'dimensions')).toBe('0,95 × 1,3 × ?\u00A0м')
    expect(valueOf(base, 'objectTypes')).toBe('Склад, unknown')
    expect(valueOf(base, 'confirmed')).toBe('Подтверждено')
    expect(valueOf({ ...base, confirmed: false }, 'confirmed')).toBe('Допущение')
  })
})

describe('buildComparison', () => {
  const other: Robot = { ...base, id: 'r2', name: 'Робот 2', price: 5_000_000 }

  it('отмечает строки с различающимися значениями', () => {
    const rows = buildComparison([base, other], ctx).flatMap((g) => g.rows)
    expect(rows.find((r) => r.key === 'price')?.differs).toBe(true)
    expect(rows.find((r) => r.key === 'manufacturer')?.differs).toBe(false)
    expect(rows.find((r) => r.key === 'price')?.values).toEqual([s('4 200 000 ₽'), s('5 000 000 ₽')])
  })
  it('«нет данных» против значения — тоже различие', () => {
    const rows = buildComparison([base, { ...other, raasMonthlyPrice: 100_000 }], ctx).flatMap((g) => g.rows)
    expect(rows.find((r) => r.key === 'raasMonthlyPrice')?.differs).toBe(true)
  })
  it('название не входит в строки (оно в заголовке столбца)', () => {
    const rows = buildComparison([base, other], ctx).flatMap((g) => g.rows)
    expect(rows.some((r) => r.key === 'name')).toBe(false)
  })
})
