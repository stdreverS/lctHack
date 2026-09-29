import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateParams } from '@/utils/validateParams'
import { objectTypes } from './objectTypes'

const CONFIG = fileURLToPath(new URL('../../../../backend/config/object-types.json', import.meta.url))

describe('типы объектов', () => {
  it('совпадают с backend/config/object-types.json', () => {
    expect(JSON.parse(readFileSync(CONFIG, 'utf-8'))).toEqual(JSON.parse(JSON.stringify(objectTypes)))
  })

  it('demoParams каждого типа проходят проверку формы', () => {
    for (const t of objectTypes) {
      expect(validateParams(t.fields, t.demoParams), t.code).toEqual([])
      expect(Object.keys(t.demoParams).sort(), t.code).toEqual(t.fields.map((f) => f.key).sort())
    }
  })

  it('у каждого поля есть существующая группа, у списков — варианты', () => {
    for (const t of objectTypes) {
      const groups = new Set(t.groups.map((g) => g.key))
      for (const f of t.fields) {
        expect(groups.has(f.group), `${t.code}.${f.key}`).toBe(true)
        if (f.type === 'enum') expect(f.options?.length, `${t.code}.${f.key}`).toBeGreaterThan(1)
      }
    }
  })

  it('аэропорт и больница содержат поля п. 3.2.1 ТЗ', () => {
    const keys = (code: string) => objectTypes.find((t) => t.code === code)!.fields.map((f) => f.key)
    expect(keys('airport')).toEqual(expect.arrayContaining([
      'operationType', 'operationZone', 'hoursPerDay', 'loadKg', 'loadLengthM', 'loadWidthM', 'safetyLevel', 'zoneEnvironment',
    ]))
    expect(keys('hospital')).toEqual(expect.arrayContaining([
      'institutionType', 'areaM2', 'floors', 'workMode', 'sanitationLevel', 'accessRestrictions',
    ]))
  })
})
