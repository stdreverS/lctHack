import { afterEach, describe, expect, it } from 'vitest'
import { MOCK_DB_KEY, parseSnapshot, resetMockDb, restoreMockDb, saveMockDb, type KeyValueStorage } from './persist'
import { handleMockRequest } from './router'
import { projects } from './data/projects'
import { robots } from './data/robots'
import { USER_ID } from './data/users'

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const TOKEN = `mock-token:${USER_ID}`
const input = { name: 'Проверка сохранения', objectType: 'warehouse', params: {}, assumptions: {} }

afterEach(() => resetMockDb(null))

describe('сохранение мок-базы', () => {
  it('созданный проект переживает «перезагрузку»', () => {
    const storage = memoryStorage()
    const created = handleMockRequest({ method: 'POST', url: '/projects', body: input, token: TOKEN })
    const id = (created.body as { id: string }).id
    saveMockDb(storage)

    resetMockDb(null) // как после F5: в памяти исходные данные
    expect(projects.some((p) => p.id === id)).toBe(false)

    expect(restoreMockDb(storage)).toBe(true)
    expect(projects.some((p) => p.id === id)).toBe(true)
  })

  it('сброс возвращает исходные данные и удаляет снимок', () => {
    const storage = memoryStorage()
    const before = robots.length
    robots.splice(0, 1)
    saveMockDb(storage)
    resetMockDb(storage)
    expect(robots).toHaveLength(before)
    expect(storage.data.has(MOCK_DB_KEY)).toBe(false)
  })

  it('повреждённый или чужой снимок игнорируется и удаляется', () => {
    const storage = memoryStorage()
    storage.setItem(MOCK_DB_KEY, '{"version":1,"seed":"другие-данные","users":[],"robots":[],"projects":[],"calculations":[]}')
    expect(restoreMockDb(storage)).toBe(false)
    expect(storage.data.has(MOCK_DB_KEY)).toBe(false)
    expect(parseSnapshot('не json')).toBeNull()
    expect(parseSnapshot(null)).toBeNull()
  })

  it('без хранилища работает как раньше', () => {
    expect(restoreMockDb(null)).toBe(false)
    expect(() => saveMockDb(null)).not.toThrow()
  })
})
