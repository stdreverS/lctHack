// Сохранение мок-базы в localStorage: после F5 проекты, расчёты, каталог и
// зарегистрированные пользователи остаются. Массивы из mocks/data меняются на месте —
// обработчики router.ts держат ссылки на них.
import type { Robot } from '@/types/api'
import { calculations, projects, type MockCalculation, type MockProject } from './data/projects'
import { robots } from './data/robots'
import { users, type MockUser } from './data/users'

export const MOCK_DB_KEY = 'robo.mockDb'
const VERSION = 1

/** Хранилище с интерфейсом localStorage; null — хранить негде (тесты, приватный режим). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface Tables {
  users: MockUser[]
  robots: Robot[]
  projects: MockProject[]
  calculations: MockCalculation[]
}

interface Snapshot extends Tables {
  version: number
  /** Отпечаток исходных данных: демо-данные в коде изменились — сохранённая база устарела. */
  seed: string
}

const TABLES: Tables = { users, robots, projects, calculations }
const TABLE_NAMES = Object.keys(TABLES) as (keyof Tables)[]

/** Исходные данные моков — копия до восстановления из хранилища. */
const seedTables: Tables = structuredClone(TABLES)
const seedHash = hash(JSON.stringify(seedTables))

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function replaceAll(tables: Tables): void {
  for (const name of TABLE_NAMES) {
    const target = TABLES[name] as unknown[]
    target.splice(0, target.length, ...structuredClone(tables[name]))
  }
}

function isRows(value: unknown): value is { id: string }[] {
  return Array.isArray(value) && value.every((row) => typeof row === 'object' && row !== null && typeof (row as { id?: unknown }).id === 'string')
}

/** Разбор сохранённого снимка; null — снимка нет, он повреждён или от других демо-данных. */
export function parseSnapshot(raw: string | null): Tables | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<Snapshot>
    if (data.version !== VERSION || data.seed !== seedHash) return null
    if (!TABLE_NAMES.every((name) => isRows(data[name]))) return null
    return { users: data.users!, robots: data.robots!, projects: data.projects!, calculations: data.calculations! }
  } catch {
    return null
  }
}

/** Подставляет сохранённую базу вместо исходной. true — база восстановлена. */
export function restoreMockDb(storage: KeyValueStorage | null = defaultStorage()): boolean {
  if (!storage) return false
  try {
    const raw = storage.getItem(MOCK_DB_KEY)
    const tables = parseSnapshot(raw)
    if (tables) {
      replaceAll(tables)
      return true
    }
    if (raw !== null) storage.removeItem(MOCK_DB_KEY) // устаревший или повреждённый снимок
  } catch {
    // хранилище недоступно — работаем с исходными данными
  }
  return false
}

export function saveMockDb(storage: KeyValueStorage | null = defaultStorage()): void {
  if (!storage) return
  const snapshot: Snapshot = { version: VERSION, seed: seedHash, ...TABLES }
  try {
    storage.setItem(MOCK_DB_KEY, JSON.stringify(snapshot))
  } catch {
    // переполнение или запрет записи — данные живут до перезагрузки, как раньше
  }
}

/** Возвращает демо-данные к исходным и удаляет сохранённую базу. */
export function resetMockDb(storage: KeyValueStorage | null = defaultStorage()): void {
  replaceAll(seedTables)
  try {
    storage?.removeItem(MOCK_DB_KEY)
  } catch {
    // нечего удалять
  }
}
