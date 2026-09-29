import { describe, expect, it } from 'vitest'
import { clearDrafts, draftKey, parseDraft, readDraft, writeDraft, type DraftStorage, type WizardDraft } from './wizardDraft'

function memoryStorage(): DraftStorage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
}

const draft: WizardDraft = {
  step: 3,
  objectType: 'warehouse',
  processes: ['receiving'],
  fillMode: 'demo',
  selectedRobotIds: ['r1'],
  manualRobotIds: [],
  scenarios: [{ id: 'baseline', kind: 'baseline', title: 'Текущее состояние', robotId: null }],
  simKind: 'purchase',
  params: { areaM2: 12000 },
}

describe('черновик мастера', () => {
  it('записывается и читается обратно', () => {
    const storage = memoryStorage()
    writeDraft(null, draft, storage)
    expect(readDraft(null, 8, storage)).toEqual(draft)
    expect(readDraft('p1', 8, storage)).toBeNull()
  })

  it('гость и проекты — разные ключи', () => {
    expect(draftKey(null)).not.toBe(draftKey('p1'))
    expect(draftKey('p1')).not.toBe(draftKey('p2'))
  })

  it('неверный шаг, версия или мусор → null', () => {
    expect(parseDraft(JSON.stringify({ version: 1, ...draft, step: 8 }), 8)).toBeNull()
    expect(parseDraft(JSON.stringify({ version: 2, ...draft }), 8)).toBeNull()
    expect(parseDraft(JSON.stringify({ version: 1, ...draft, processes: 'x' }), 8)).toBeNull()
    expect(parseDraft('{', 8)).toBeNull()
  })

  it('clearDrafts удаляет только черновики мастера', () => {
    const storage = memoryStorage()
    writeDraft(null, draft, storage)
    writeDraft('p1', draft, storage)
    storage.setItem('other', '1')
    clearDrafts(storage)
    expect(storage.length).toBe(1)
    expect(storage.getItem('other')).toBe('1')
  })
})
