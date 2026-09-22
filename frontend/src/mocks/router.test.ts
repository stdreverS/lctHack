import { describe, expect, it } from 'vitest'
import type { ApiError, AuthResponse, CalcRequest, CalcResult, ProjectSummary, RobotInput } from '@/types/api'
import { handleMockRequest, type MockRequest } from './router'
import { defaultAssumptions, objectTypes } from './data/objectTypes'
import { PROJECT_IDS, defaultScenarios } from './data/projects'
import { robots } from './data/robots'
import { ADMIN_ID, USER_ID } from './data/users'

const USER_TOKEN = `mock-token:${USER_ID}`
const ADMIN_TOKEN = `mock-token:${ADMIN_ID}`

function call(method: MockRequest['method'], url: string, body?: unknown, token: string | null = null) {
  return handleMockRequest({ method, url, body, token })
}

function error(res: { body?: unknown }): ApiError {
  return res.body as ApiError
}

const robotInput: RobotInput = { ...robots[0]!, name: 'Тестовый робот' }
delete (robotInput as Partial<{ id: string }>).id

const calcRequest = (projectId: string | null): CalcRequest => ({
  projectId,
  objectType: 'warehouse',
  processes: ['internal_transport'],
  params: { ...objectTypes[0]!.demoParams },
  assumptions: { ...defaultAssumptions },
  scenarios: defaultScenarios(),
  sensitivity: { params: ['equipmentPrice', 'operationsVolume', 'laborCost'], deltas: [-0.2, -0.1, 0.1, 0.2] },
})

describe('авторизация', () => {
  it('верный вход возвращает токен и пользователя без пароля', () => {
    const res = call('POST', '/auth/login', { email: 'user@demo.ru', password: 'Demo12345' })
    expect(res.status).toBe(200)
    const body = res.body as AuthResponse
    expect(body.token).toBe(USER_TOKEN)
    expect(body.user).toEqual({ id: USER_ID, email: 'user@demo.ru', name: expect.any(String), role: 'user' })
    expect(body.user).not.toHaveProperty('password')
  })

  it('вход админа', () => {
    const res = call('POST', '/auth/login', { email: 'admin@demo.ru', password: 'Admin12345' })
    expect((res.body as AuthResponse).user.role).toBe('admin')
  })

  it('неверный пароль → 401 INVALID_CREDENTIALS', () => {
    const res = call('POST', '/auth/login', { email: 'user@demo.ru', password: 'wrong-pass' })
    expect(res.status).toBe(401)
    expect(error(res).code).toBe('INVALID_CREDENTIALS')
  })

  it('регистрация на занятую почту → 409 CONFLICT', () => {
    const res = call('POST', '/auth/register', { email: 'user@demo.ru', password: 'Password1', name: 'Иван' })
    expect(res.status).toBe(409)
    expect(error(res).code).toBe('CONFLICT')
  })

  it('короткий пароль → 400 VALIDATION_ERROR с полем password', () => {
    const res = call('POST', '/auth/register', { email: 'new@demo.ru', password: '123', name: 'Иван' })
    expect(res.status).toBe(400)
    expect(error(res).code).toBe('VALIDATION_ERROR')
    expect(error(res).errors?.map((e) => e.field)).toContain('password')
  })

  it('успешная регистрация, затем вход новым пользователем', () => {
    const reg = call('POST', '/auth/register', { email: 'petrov@demo.ru', password: 'Password1', name: 'Пётр' })
    expect(reg.status).toBe(201)
    const login = call('POST', '/auth/login', { email: 'petrov@demo.ru', password: 'Password1' })
    expect(login.status).toBe(200)
  })
})

describe('проекты', () => {
  it('без токена → 401 AUTH_REQUIRED', () => {
    const res = call('GET', '/projects')
    expect(res.status).toBe(401)
    expect(error(res).code).toBe('AUTH_REQUIRED')
  })

  it('с поддельным токеном → 401', () => {
    expect(call('GET', '/projects', undefined, 'mock-token:unknown').status).toBe(401)
  })

  it('у user@demo.ru два проекта, у админа — свои', () => {
    const res = call('GET', '/projects', undefined, USER_TOKEN)
    expect(res.status).toBe(200)
    expect((res.body as ProjectSummary[]).length).toBe(2)
    expect((call('GET', '/projects', undefined, ADMIN_TOKEN).body as ProjectSummary[]).length).toBe(0)
  })

  it('несуществующий проект → 404 NOT_FOUND', () => {
    const res = call('GET', '/projects/00000000-0000-0000-0000-000000000000', undefined, USER_TOKEN)
    expect(res.status).toBe(404)
    expect(error(res).code).toBe('NOT_FOUND')
  })

  it('чужой проект → 404', () => {
    expect(call('GET', `/projects/${PROJECT_IDS.podolsk}`, undefined, ADMIN_TOKEN).status).toBe(404)
  })
})

describe('каталог роботов', () => {
  it('10 роботов, у двух данные не подтверждены', () => {
    const list = call('GET', '/robots').body as RobotInput[]
    expect(list.length).toBe(10)
    expect(list.filter((r) => !r.confirmed).length).toBe(2)
  })

  it('фильтр и сортировка', () => {
    const list = call('GET', '/robots?objectType=warehouse&solutionType=amr&sort=-price').body as RobotInput[]
    expect(list.map((r) => r.name)).toEqual(['Логимов AMR-1500', 'Логимов AMR-600'])
  })

  it('POST не админом → 403 FORBIDDEN, без токена → 401', () => {
    const res = call('POST', '/robots', robotInput, USER_TOKEN)
    expect(res.status).toBe(403)
    expect(error(res).code).toBe('FORBIDDEN')
    expect(call('POST', '/robots', robotInput).status).toBe(401)
  })

  it('POST админом создаёт робота', () => {
    const res = call('POST', '/robots', robotInput, ADMIN_TOKEN)
    expect(res.status).toBe(201)
    expect((res.body as { id: string }).id).toBeTruthy()
  })

  it('несуществующий робот → 404', () => {
    expect(call('GET', '/robots/nope').status).toBe(404)
    expect(call('DELETE', '/robots/nope', undefined, ADMIN_TOKEN).status).toBe(404)
  })

  it('неизвестный адрес → 404', () => {
    expect(error(call('GET', '/unknown')).code).toBe('NOT_FOUND')
  })
})

describe('расчёт', () => {
  it('гость получает результат без calculationId', () => {
    const res = call('POST', '/calculations', calcRequest(null))
    expect(res.status).toBe(200)
    expect((res.body as CalcResult).calculationId).toBeNull()
  })

  it('подбор содержит все три статуса; сценарии согласованы', () => {
    const result = call('POST', '/calculations', calcRequest(null)).body as CalcResult
    const statuses = new Set(result.recommendation.map((r) => r.status))
    expect(statuses).toEqual(new Set(['recommended', 'needs_check', 'excluded']))
    expect(result.scenarios.map((s) => s.kind)).toEqual(['baseline', 'purchase', 'raas'])
    for (const s of result.scenarios) {
      const m = s.metrics
      expect(m.annualEffectRub.value).toBe(-(m.opexDeltaRub.value ?? 0))
      expect(s.cashflow.at(-1)!.cumulativeRub).toBe(
        (m.annualEffectRub.value ?? 0) * defaultAssumptions.horizonYears - (m.capexRub.value ?? 0),
      )
    }
    expect(result.sensitivity.length).toBe(2 * 3)
  })

  it('расчёт проекта сохраняется в истории', () => {
    const result = call('POST', '/calculations', calcRequest(PROJECT_IDS.kazan), USER_TOKEN).body as CalcResult
    expect(result.calculationId).toBeTruthy()
    const history = call('GET', `/projects/${PROJECT_IDS.kazan}/calculations`, undefined, USER_TOKEN)
    expect((history.body as { id: string }[]).map((c) => c.id)).toContain(result.calculationId)
  })

  it('неизвестный тип объекта → 400 с полем objectType', () => {
    const res = call('POST', '/calculations', { ...calcRequest(null), objectType: 'moon' })
    expect(res.status).toBe(400)
    expect(error(res).errors?.[0]?.field).toBe('objectType')
  })
})
