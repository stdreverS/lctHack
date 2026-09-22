// Вспомогательные функции рабочей зоны: новый проект и отображение окупаемости.
import type { Assumptions, ObjectType, Params, ProjectInput, Verdict } from '@/types/api'

/**
 * Допущения нового проекта. В API нет справочника допущений по умолчанию,
 * поэтому фронтенд задаёт их сам (значения — как в примерах docs/api-examples.md).
 * Пользователь уточнит их в мастере.
 */
export const DEFAULT_ASSUMPTIONS: Readonly<Assumptions> = {
  horizonYears: 5,
  workDaysPerYear: 250,
  shiftsPerDay: 2,
  hoursPerShift: 8,
  utilization: 0.85,
  availability: 0.95,
  reserveShare: 0.1,
  staffReplacedShare: 0.3,
}

/** Параметры по умолчанию из описания полей типа объекта; без default — null. */
export function defaultParams(type: Pick<ObjectType, 'fields'>): Params {
  return Object.fromEntries(type.fields.map((f) => [f.key, f.default ?? null]))
}

export function newProjectInput(name: string, type: Pick<ObjectType, 'code' | 'fields'>): ProjectInput {
  return {
    name: name.trim(),
    objectType: type.code,
    params: defaultParams(type),
    assumptions: { ...DEFAULT_ASSUMPTIONS },
  }
}

/** 'none' — расчёта нет или проект не окупается (API эти случаи не различает). */
export type PaybackLevel = Exclude<Verdict['level'], 'negative'> | 'none'

/** Уровень окупаемости для цвета: до 3 лет / 3–5 лет / более 5 лет (пороги Verdict из контракта). */
export function paybackLevel(years: number | null | undefined): PaybackLevel {
  if (typeof years !== 'number' || !Number.isFinite(years) || years < 0) return 'none'
  if (years <= 3) return 'good'
  if (years <= 5) return 'moderate'
  return 'poor'
}
