import { describe, expect, it } from 'vitest'
import type { ParamField } from '@/types/api'
import { buildCsvTemplate, parseCsvNumber, parseParamsCsv } from './csvParams'

const fields: ParamField[] = [
  { key: 'areaM2', label: 'Площадь склада', group: 'object', type: 'number', unit: 'м²', required: true, min: 100, max: 500000, example: 12000 },
  {
    key: 'workMode', label: 'Режим работы', group: 'object', type: 'enum', required: true, default: '2x8',
    options: [{ value: '1x8', label: '1 смена по 8 ч' }, { value: '2x8', label: '2 смены по 8 ч' }],
  },
  { key: 'staffCount', label: 'Персонал; все смены', group: 'staff', type: 'integer', unit: 'чел.', required: true, min: 1, example: 64 },
  { key: 'unitLengthM', label: 'Длина', group: 'goods', type: 'number', unit: 'м', required: true, example: 1.2 },
  { key: 'hasBhs', label: 'Есть BHS', group: 'object', type: 'boolean', required: true, default: true },
  { key: 'note', label: 'Комментарий', group: 'object', type: 'string', required: false },
]

describe('buildCsvTemplate', () => {
  const csv = buildCsvTemplate(fields)
  const lines = csv.replace(/^﻿/, '').split('\r\n')

  it('BOM, заголовок и строка на каждое поле', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(lines[0]).toBe('key;label;unit;value')
    expect(lines).toHaveLength(fields.length + 1)
  })

  it('value — example (или default), числа с десятичной запятой, boolean словами', () => {
    expect(lines[1]).toBe('areaM2;Площадь склада;м²;12000')
    expect(lines[2]).toBe('workMode;Режим работы;;2x8')
    expect(lines[4]).toBe('unitLengthM;Длина;м;1,2')
    expect(lines[5]).toBe('hasBhs;Есть BHS;;да')
    expect(lines[6]).toBe('note;Комментарий;;')
  })

  it('ячейку с разделителем берёт в кавычки', () => {
    expect(lines[3]).toBe('staffCount;"Персонал; все смены";чел.;64')
  })

  it('шаблон разбирается обратно без ошибок', () => {
    const report = parseParamsCsv(csv, fields)
    expect(report.fileError).toBeNull()
    expect(report.invalid).toEqual([])
    expect(report.unknownKeys).toEqual([])
    expect(report.params).toEqual({ areaM2: 12000, workMode: '2x8', staffCount: 64, unitLengthM: 1.2, hasBhs: true })
  })
})

describe('parseCsvNumber', () => {
  it.each([
    ['12000', 12000],
    ['12 000', 12000],
    ['12 000,5', 12000.5],
    ['1.5', 1.5],
    ['-3', -3],
    ['1e3', 1000],
    ['abc', null],
    ['1,2,3', null],
    ['', null],
  ] as const)('%s → %s', (raw, expected) => {
    expect(parseCsvNumber(raw)).toBe(expected)
  })
})

describe('parseParamsCsv', () => {
  it('разделитель «;», сопоставление по key, приведение типов', () => {
    const csv = 'key;label;unit;value\nareaM2;Площадь;м²;15 000\nworkMode;;;1 смена по 8 ч\nhasBhs;;;нет\nnote;;;Ночная смена'
    const report = parseParamsCsv(csv, fields)
    expect(report.params).toEqual({ areaM2: 15000, workMode: '1x8', hasBhs: false, note: 'Ночная смена' })
    expect(report.filled).toEqual(['areaM2', 'workMode', 'hasBhs', 'note'])
  })

  it('разделитель «,» и порядок столбцов не важен', () => {
    const csv = 'value,key\n2000,areaM2\n"1,5",unitLengthM'
    expect(parseParamsCsv(csv, fields).params).toEqual({ areaM2: 2000, unitLengthM: 1.5 })
  })

  it('без заголовка: первый столбец — key, последний — value', () => {
    expect(parseParamsCsv('areaM2;3000\nstaffCount;Персонал;10', fields).params).toEqual({ areaM2: 3000, staffCount: 10 })
  })

  it('отчёт: нераспознанные ключи и значения, не прошедшие проверку', () => {
    const csv = [
      'key;value',
      'areaM2;50',
      'staffCount;10,5',
      'unitLengthM;много',
      'workMode;4x6',
      'hasBhs;может быть',
      'colour;red',
      'colour;blue',
      'Площадь;100',
    ].join('\n')
    const report = parseParamsCsv(csv, fields)
    expect(report.params).toEqual({})
    expect(report.unknownKeys).toEqual(['colour', 'Площадь'])
    expect(report.invalid.map((i) => [i.key, i.raw])).toEqual([
      ['areaM2', '50'],
      ['staffCount', '10,5'],
      ['unitLengthM', 'много'],
      ['workMode', '4x6'],
      ['hasBhs', 'может быть'],
    ])
    expect(report.invalid[0]!.message).toMatch(/минимум 100/)
    expect(report.invalid[1]!.message).toMatch(/целое число/)
    expect(report.invalid[2]!.message).toMatch(/Ожидается число/)
  })

  it('пустые значения пропускаются, BOM и пустые строки не мешают', () => {
    const report = parseParamsCsv('﻿key;value\r\n\r\nareaM2;\r\nstaffCount;12\r\n', fields)
    expect(report.params).toEqual({ staffCount: 12 })
    expect(report.invalid).toEqual([])
  })

  it('повтор ключа — действует последняя строка', () => {
    const report = parseParamsCsv('key;value\nareaM2;50\nareaM2;500', fields)
    expect(report.params).toEqual({ areaM2: 500 })
    expect(report.invalid).toEqual([])
    expect(report.filled).toEqual(['areaM2'])
  })

  it('ошибки файла целиком', () => {
    expect(parseParamsCsv('', fields).fileError).toMatch(/пустой/)
    expect(parseParamsCsv('просто текст', fields).fileError).toMatch(/key и value/)
    expect(parseParamsCsv('key;value\n', fields).fileError).toMatch(/нет строк/)
  })
})
