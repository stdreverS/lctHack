// Черновик мастера в sessionStorage: после F5 мастер возвращается на тот же шаг с теми же
// данными. Хранится только ввод пользователя — результаты расчётов шаги пересчитают сами.
// sessionStorage, а не localStorage: гостевые данные не переживают закрытие вкладки (п. 3.1.2 ТЗ).
import type { Assumptions, Params, ScenarioInput } from '@/types/api'

const PREFIX = 'robo.wizard.'
const VERSION = 1

/** Гость: весь ввод. Проект: только то, чего нет в самом проекте (параметры берутся с сервера). */
export interface WizardDraft {
  step: number
  objectType: string | null
  processes: string[]
  fillMode: 'demo' | 'manual' | 'csv' | null
  selectedRobotIds: string[]
  manualRobotIds: string[]
  scenarios: ScenarioInput[]
  simKind: 'purchase' | 'raas'
  /** Только у гостя. */
  params?: Params
  assumptions?: Assumptions
}

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function defaultStorage(): DraftStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** Ключ черновика: гостевой мастер или конкретный проект. */
export function draftKey(projectId: string | null): string {
  return `${PREFIX}${projectId ? `project.${projectId}` : 'guest'}`
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Разбор черновика; null — нет, повреждён или от другой версии. */
export function parseDraft(raw: string | null, stepCount: number): WizardDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Record<string, unknown>
    if (d.version !== VERSION) return null
    const step = d.step
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step >= stepCount) return null
    if (d.objectType !== null && typeof d.objectType !== 'string') return null
    if (!isStrings(d.processes) || !isStrings(d.selectedRobotIds) || !isStrings(d.manualRobotIds)) return null
    if (!Array.isArray(d.scenarios) || !d.scenarios.every((s) => isRecord(s) && typeof s.kind === 'string')) return null
    const fillMode = d.fillMode === 'demo' || d.fillMode === 'manual' || d.fillMode === 'csv' ? d.fillMode : null
    const draft: WizardDraft = {
      step,
      objectType: d.objectType,
      processes: d.processes,
      fillMode,
      selectedRobotIds: d.selectedRobotIds,
      manualRobotIds: d.manualRobotIds,
      scenarios: d.scenarios as ScenarioInput[],
      simKind: d.simKind === 'raas' ? 'raas' : 'purchase',
    }
    if (isRecord(d.params)) draft.params = d.params as Params
    if (isRecord(d.assumptions)) draft.assumptions = d.assumptions as unknown as Assumptions
    return draft
  } catch {
    return null
  }
}

export function readDraft(projectId: string | null, stepCount: number, storage = defaultStorage()): WizardDraft | null {
  try {
    return parseDraft(storage?.getItem(draftKey(projectId)) ?? null, stepCount)
  } catch {
    return null
  }
}

export function writeDraft(projectId: string | null, draft: WizardDraft, storage = defaultStorage()): void {
  try {
    storage?.setItem(draftKey(projectId), JSON.stringify({ version: VERSION, ...draft }))
  } catch {
    // хранилище недоступно или переполнено — мастер живёт до перезагрузки, как раньше
  }
}

/** Удаляет все черновики мастера (сброс демо-данных). */
export function clearDrafts(storage = defaultStorage()): void {
  if (!storage) return
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
  } catch {
    // нечего удалять
  }
}
