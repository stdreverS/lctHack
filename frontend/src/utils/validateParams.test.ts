import { describe, expect, it } from 'vitest'
import type { ParamField } from '@/types/api'
import { validateField, validateParams } from './validateParams'

const area: ParamField = {
  key: 'areaM2', label: 'Площадь склада', group: 'object', type: 'number', unit: 'м²',
  required: true, min: 100, max: 500000, example: 12000,
}
const staff: ParamField = {
  key: 'staffCount', label: 'Персонал', group: 'staff', type: 'integer', unit: 'чел.',
  required: true, min: 1, max: 10000, example: 64,
}
const mode: ParamField = {
  key: 'workMode', label: 'Режим работы', group: 'object', type: 'enum', required: true,
  options: [{ value: '1x8', label: '1 смена по 8 ч' }, { value: '2x8', label: '2 смены по 8 ч' }],
}
const bhs: ParamField = { key: 'hasBhs', label: 'BHS', group: 'object', type: 'boolean', required: true }
const height: ParamField = {
  key: 'unitHeightM', label: 'Высота', group: 'goods', type: 'number', unit: 'м', required: false, min: 0.05, max: 3,
}
const note: ParamField = { key: 'note', label: 'Комментарий', group: 'object', type: 'string', required: true }

describe('validateField: обязательность', () => {
  it('пустое обязательное число — с примером', () => {
    expect(validateField(area, null)).toBe('Заполните поле, например 12\u00A0000\u00A0м²')
    expect(validateField(area, undefined)).toMatch(/^Заполните поле/)
  })

  it('пустые enum, boolean, строка', () => {
    expect(validateField(mode, null)).toBe('Выберите значение из списка')
    expect(validateField(bhs, null)).toBe('Выберите «Да» или «Нет»')
    expect(validateField(note, '   ')).toBe('Заполните поле')
  })

  it('пустое необязательное поле допустимо', () => {
    expect(validateField(height, null)).toBeNull()
  })
})

describe('validateField: числа', () => {
  it('допустимые значения, включая границы', () => {
    expect(validateField(area, 12000)).toBeNull()
    expect(validateField(area, 100)).toBeNull()
    expect(validateField(area, 500000)).toBeNull()
  })

  it('меньше минимума и больше максимума', () => {
    expect(validateField(area, 99)).toBe('Слишком маленькое значение: минимум 100\u00A0м². Увеличьте значение')
    expect(validateField(area, 500001)).toBe('Слишком большое значение: максимум 500\u00A0000\u00A0м². Уменьшите значение')
    expect(validateField(height, 0.01)).toMatch(/минимум 0,05\u00A0м/)
  })

  it('не число', () => {
    expect(validateField(area, 'много')).toMatch(/^Введите число/)
    expect(validateField(area, Number.NaN)).toMatch(/^Введите число/)
    expect(validateField(area, true)).toMatch(/^Введите число/)
  })

  it('integer не принимает дробные', () => {
    expect(validateField(staff, 64)).toBeNull()
    expect(validateField(staff, 64.5)).toBe('Введите целое число без дробной части, например 64\u00A0чел.')
  })
})

describe('validateField: enum, boolean, string', () => {
  it('enum — только значения из options', () => {
    expect(validateField(mode, '2x8')).toBeNull()
    expect(validateField(mode, '4x6')).toBe('Выберите значение из списка: 1 смена по 8 ч; 2 смены по 8 ч')
  })

  it('boolean — только true/false', () => {
    expect(validateField(bhs, false)).toBeNull()
    expect(validateField(bhs, 'да')).toBe('Выберите «Да» или «Нет»')
  })

  it('string — только строка', () => {
    expect(validateField(note, 'текст')).toBeNull()
    expect(validateField(note, 5)).toBe('Введите текст')
  })
})

describe('validateParams', () => {
  it('возвращает ошибки в порядке полей с названиями', () => {
    const issues = validateParams([area, mode, staff, height], { areaM2: 50, workMode: '2x8', staffCount: null })
    expect(issues.map((i) => i.key)).toEqual(['areaM2', 'staffCount'])
    expect(issues[0]!.label).toBe('Площадь склада')
  })

  it('валидные параметры — пустой список', () => {
    expect(validateParams([area, mode], { areaM2: 1000, workMode: '1x8' })).toEqual([])
  })
})
