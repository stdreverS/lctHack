import { describe, expect, it } from 'vitest'
import { formatDate, formatNumber, formatPercent, formatRub, formatYears, pluralYears } from './format'

// В ожидаемых строках пробел — неразрывный (U+00A0); заменяем для читаемости.
const s = (text: string) => text.replace(/ /g, ' ')

describe('formatNumber', () => {
  it('разделяет разряды пробелом и ставит запятую', () => {
    expect(formatNumber(1234567.891)).toBe(s('1 234 567,89'))
    expect(formatNumber(1000)).toBe(s('1 000'))
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(0)).toBe('0')
  })

  it('учитывает число знаков после запятой', () => {
    expect(formatNumber(3.14159, 0)).toBe('3')
    expect(formatNumber(3.14159, 3)).toBe('3,142')
  })

  it('отрицательные числа', () => {
    expect(formatNumber(-12345.5)).toBe(s('-12 345,5'))
  })

  it('нет значения → тире', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber(Number.NaN)).toBe('—')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatRub', () => {
  it('рубли без копеек', () => {
    expect(formatRub(12400000)).toBe(s('12 400 000 ₽'))
    expect(formatRub(1234.6)).toBe(s('1 235 ₽'))
    expect(formatRub(0)).toBe(s('0 ₽'))
    expect(formatRub(-500000)).toBe(s('-500 000 ₽'))
  })

  it('нет значения → тире', () => {
    expect(formatRub(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('значение в процентах, один знак после запятой', () => {
    expect(formatPercent(31.5)).toBe(s('31,5 %'))
    expect(formatPercent(31.56)).toBe(s('31,6 %'))
    expect(formatPercent(40)).toBe(s('40 %'))
    expect(formatPercent(-12.3)).toBe(s('-12,3 %'))
    expect(formatPercent(1234.5)).toBe(s('1 234,5 %'))
  })

  it('без «-0» после округления', () => {
    expect(formatPercent(-0.01)).toBe(s('0 %'))
  })

  it('нет значения → тире', () => {
    expect(formatPercent(null)).toBe('—')
  })
})

describe('pluralYears', () => {
  it.each([
    [1, 'год'],
    [2, 'года'],
    [4, 'года'],
    [5, 'лет'],
    [0, 'лет'],
    [11, 'лет'],
    [12, 'лет'],
    [14, 'лет'],
    [21, 'год'],
    [22, 'года'],
    [25, 'лет'],
    [101, 'год'],
    [111, 'лет'],
    [2.4, 'года'],
    [1.5, 'года'],
    [0.5, 'года'],
  ])('%d → %s', (value, word) => {
    expect(pluralYears(value)).toBe(word)
  })
})

describe('formatYears', () => {
  it('склоняет слово «год»', () => {
    expect(formatYears(1)).toBe(s('1 год'))
    expect(formatYears(2)).toBe(s('2 года'))
    expect(formatYears(5)).toBe(s('5 лет'))
    expect(formatYears(11)).toBe(s('11 лет'))
    expect(formatYears(21)).toBe(s('21 год'))
    expect(formatYears(2.4)).toBe(s('2,4 года'))
  })

  it('склоняет по округлённому значению', () => {
    expect(formatYears(0.96)).toBe(s('1 год'))
    expect(formatYears(4.98)).toBe(s('5 лет'))
    expect(formatYears(2.44)).toBe(s('2,4 года'))
    expect(formatYears(3.7, 0)).toBe(s('4 года'))
  })

  it('нет значения → тире', () => {
    expect(formatYears(null)).toBe('—')
  })
})

describe('formatDate', () => {
  // Часовой пояс тестов — Europe/Moscow (UTC+3), см. vitest.config.ts
  it('дата без времени', () => {
    expect(formatDate('2026-09-22T11:05:00Z')).toBe('22.09.2026')
  })

  it('дата со временем в местном часовом поясе', () => {
    expect(formatDate('2026-09-22T11:05:00Z', true)).toBe('22.09.2026, 14:05')
    expect(formatDate('2026-09-22T22:30:00Z', true)).toBe('23.09.2026, 01:30')
  })

  it('принимает Date', () => {
    expect(formatDate(new Date('2026-01-05T09:00:00Z'))).toBe('05.01.2026')
  })

  it('пустое или некорректное значение → тире', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('не дата')).toBe('—')
  })
})
