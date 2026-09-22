// Мок-сервер: "METHOD /path" → обработчик. Данные живут в памяти модуля до перезагрузки.
import type {
  AuthResponse,
  CalcRequest,
  CalculationSummary,
  FieldError,
  LoginRequest,
  Project,
  ProjectInput,
  ProjectSummary,
  RegisterRequest,
  Robot,
  RobotInput,
} from '@/types/api'
import { MockFail } from './fail'
import { bestPayback, buildCalcResult } from './data/calculation'
import { objectTypes } from './data/objectTypes'
import { calculations, projects, type MockCalculation, type MockProject } from './data/projects'
import { robots } from './data/robots'
import { toPublicUser, users, type MockUser } from './data/users'

export type MockMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface MockRequest {
  method: MockMethod
  /** Путь без префикса /api/v1, с query: "/robots?objectType=warehouse" */
  url: string
  body?: unknown
  token: string | null
}

export interface MockResponse {
  status: number
  body?: unknown
}

interface Ctx {
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  user: MockUser | null
}

type Handler = (ctx: Ctx) => MockResponse

// ---------- Вспомогательное ----------

const ok = (body: unknown, status = 200): MockResponse => ({ status, body })
const noContent = (): MockResponse => ({ status: 204 })
const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

function notFound(what: string): never {
  throw new MockFail(404, 'NOT_FOUND', `${what} не найден — возможно, он был удалён`)
}

function invalid(errors: FieldError[]): never {
  throw new MockFail(400, 'VALIDATION_ERROR', 'Проверьте введённые данные', errors)
}

function requireUser(ctx: Ctx): MockUser {
  if (!ctx.user) throw new MockFail(401, 'AUTH_REQUIRED', 'Войдите в систему, чтобы продолжить')
  return ctx.user
}

function requireAdmin(ctx: Ctx): MockUser {
  const user = requireUser(ctx)
  if (user.role !== 'admin') {
    throw new MockFail(403, 'FORBIDDEN', 'Изменять каталог может только администратор')
  }
  return user
}

function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

function userByToken(token: string | null): MockUser | null {
  const prefix = 'mock-token:'
  if (!token?.startsWith(prefix)) return null
  return users.find((u) => u.id === token.slice(prefix.length)) ?? null
}

function authResponse(user: MockUser): AuthResponse {
  return { token: `mock-token:${user.id}`, user: toPublicUser(user) }
}

function ownProject(ctx: Ctx): MockProject {
  const user = requireUser(ctx)
  const project = projects.find((p) => p.id === ctx.params.id && p.ownerId === user.id)
  return project ?? notFound('Проект')
}

function ownCalculation(ctx: Ctx): MockCalculation {
  const user = requireUser(ctx)
  const calc = calculations.find((c) => c.id === ctx.params.id && c.ownerId === user.id)
  return calc ?? notFound('Расчёт')
}

function toProject({ ownerId: _ownerId, ...project }: MockProject): Project {
  return project
}

function validateProject(body: unknown): ProjectInput {
  const b = asRecord(body)
  const errors: FieldError[] = []
  if (typeof b.name !== 'string' || !b.name.trim()) {
    errors.push({ field: 'name', message: 'Укажите название проекта', hint: 'Например: «Склад Подольск — роботизация приёмки»' })
  }
  if (!objectTypes.some((t) => t.code === b.objectType)) {
    errors.push({ field: 'objectType', message: 'Выберите тип объекта из списка' })
  }
  if (errors.length) invalid(errors)
  return b as unknown as ProjectInput
}

function validateRobot(body: unknown): RobotInput {
  const b = asRecord(body)
  const errors: FieldError[] = []
  if (typeof b.name !== 'string' || !b.name.trim()) errors.push({ field: 'name', message: 'Укажите название робота' })
  if (typeof b.manufacturer !== 'string' || !b.manufacturer.trim()) errors.push({ field: 'manufacturer', message: 'Укажите производителя' })
  if (typeof b.price !== 'number' || b.price <= 0) errors.push({ field: 'price', message: 'Цена должна быть больше нуля', hint: 'Цена в рублях с НДС, например 4200000' })
  if (errors.length) invalid(errors)
  return b as unknown as RobotInput
}

// ---------- Обработчики ----------

const routes: Record<string, Handler> = {
  'POST /auth/login': ({ body }) => {
    const { email, password } = asRecord(body) as Partial<LoginRequest>
    const user = users.find((u) => u.email.toLowerCase() === String(email ?? '').trim().toLowerCase())
    if (!user || user.password !== password) {
      throw new MockFail(401, 'INVALID_CREDENTIALS', 'Неверная почта или пароль. Проверьте раскладку и Caps Lock')
    }
    return ok(authResponse(user))
  },

  'POST /auth/register': ({ body }) => {
    const { email, password, name } = asRecord(body) as Partial<RegisterRequest>
    const errors: FieldError[] = []
    const mail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      errors.push({ field: 'email', message: 'Введите корректный адрес почты', hint: 'Например: ivanov@company.ru' })
    }
    if (typeof password !== 'string' || password.length < 8) {
      errors.push({ field: 'password', message: 'Пароль должен быть не короче 8 символов', hint: 'Используйте буквы и цифры' })
    }
    if (typeof name !== 'string' || !name.trim()) {
      errors.push({ field: 'name', message: 'Укажите имя', hint: 'Как к вам обращаться' })
    }
    if (errors.length) invalid(errors)
    if (users.some((u) => u.email === mail)) {
      throw new MockFail(409, 'CONFLICT', 'Пользователь с такой почтой уже зарегистрирован — войдите или укажите другую почту')
    }
    const user: MockUser = { id: newId(), email: mail, name: String(name).trim(), role: 'user', password: String(password) }
    users.push(user)
    return ok(authResponse(user), 201)
  },

  'GET /object-types': () => ok(objectTypes),

  'GET /robots': ({ query }) => {
    const objectType = query.get('objectType')
    const solutionType = query.get('solutionType')
    const q = query.get('q')?.trim().toLowerCase()
    let list = robots.filter(
      (r) =>
        (!objectType || r.objectTypes.includes(objectType)) &&
        (!solutionType || r.solutionType === solutionType) &&
        (!q || `${r.name} ${r.manufacturer}`.toLowerCase().includes(q)),
    )
    const sort = query.get('sort')
    if (sort) {
      const desc = sort.startsWith('-')
      const key = desc ? sort.slice(1) : sort
      const value = (r: Robot): number | string =>
        key === 'name' ? r.name : key === 'price' ? r.price : ((r.specs as Record<string, unknown>)[key] as number | null) ?? -Infinity
      list = [...list].sort((a, b) => {
        const va = value(a)
        const vb = value(b)
        const cmp = typeof va === 'string' ? va.localeCompare(String(vb), 'ru') : va - (vb as number)
        return desc ? -cmp : cmp
      })
    }
    return ok(list)
  },

  'GET /robots/:id': ({ params }) => ok(robots.find((r) => r.id === params.id) ?? notFound('Робот')),

  'POST /robots': (ctx) => {
    requireAdmin(ctx)
    const robot: Robot = { ...validateRobot(ctx.body), id: newId() }
    robots.push(robot)
    return ok(robot, 201)
  },

  'PUT /robots/:id': (ctx) => {
    requireAdmin(ctx)
    const index = robots.findIndex((r) => r.id === ctx.params.id)
    if (index < 0) notFound('Робот')
    const robot: Robot = { ...validateRobot(ctx.body), id: ctx.params.id! }
    robots[index] = robot
    return ok(robot)
  },

  'DELETE /robots/:id': (ctx) => {
    requireAdmin(ctx)
    const index = robots.findIndex((r) => r.id === ctx.params.id)
    if (index < 0) notFound('Робот')
    robots.splice(index, 1)
    return noContent()
  },

  'GET /projects': (ctx) => {
    const user = requireUser(ctx)
    const list: ProjectSummary[] = projects
      .filter((p) => p.ownerId === user.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => {
        const last = calculations.filter((c) => c.projectId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        return { id: p.id, name: p.name, objectType: p.objectType, updatedAt: p.updatedAt, lastPaybackYears: last ? bestPayback(last.result) : null }
      })
    return ok(list)
  },

  'POST /projects': (ctx) => {
    const user = requireUser(ctx)
    const input = validateProject(ctx.body)
    const time = now()
    const project: MockProject = { ...input, id: newId(), ownerId: user.id, createdAt: time, updatedAt: time }
    projects.push(project)
    return ok(toProject(project), 201)
  },

  'GET /projects/:id': (ctx) => ok(toProject(ownProject(ctx))),

  'PUT /projects/:id': (ctx) => {
    const project = ownProject(ctx)
    const input = validateProject(ctx.body)
    Object.assign(project, { name: input.name, objectType: input.objectType, params: input.params, assumptions: input.assumptions, updatedAt: now() })
    return ok(toProject(project))
  },

  'DELETE /projects/:id': (ctx) => {
    const project = ownProject(ctx)
    projects.splice(projects.indexOf(project), 1)
    for (let i = calculations.length - 1; i >= 0; i--) {
      if (calculations[i]!.projectId === project.id) calculations.splice(i, 1)
    }
    return noContent()
  },

  'POST /projects/:id/copy': (ctx) => {
    const source = ownProject(ctx)
    const time = now()
    const copy: MockProject = {
      ...structuredClone(source), id: newId(), name: `${source.name} (копия)`, createdAt: time, updatedAt: time,
    }
    projects.push(copy)
    return ok(toProject(copy), 201)
  },

  'POST /calculations': (ctx) => {
    const req = asRecord(ctx.body) as unknown as CalcRequest
    if (!objectTypes.some((t) => t.code === req.objectType)) {
      invalid([{ field: 'objectType', message: 'Выберите тип объекта из списка' }])
    }
    const scenarios = Array.isArray(req.scenarios) ? req.scenarios : []
    const errors: FieldError[] = []
    scenarios.forEach((s, i) => {
      if (s.kind !== 'baseline' && !robots.some((r) => r.id === s.robotId)) {
        errors.push({ field: `scenarios[${i}].robotId`, message: `Выберите робота для сценария «${s.title}»` })
      }
    })
    if (errors.length) invalid(errors)

    const project = ctx.user && req.projectId ? ownProject({ ...ctx, params: { id: req.projectId } }) : null
    const calcId = project ? newId() : null
    const result = buildCalcResult({ ...req, scenarios, sensitivity: req.sensitivity ?? { params: [], deltas: [] } }, robots, calcId)
    if (project && calcId && ctx.user) {
      calculations.push({ id: calcId, projectId: project.id, ownerId: ctx.user.id, createdAt: result.calculatedAt, request: req, result })
      project.updatedAt = result.calculatedAt
    }
    return ok(result)
  },

  'GET /projects/:id/calculations': (ctx) => {
    const project = ownProject(ctx)
    const list: CalculationSummary[] = calculations
      .filter((c) => c.projectId === project.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => ({ id: c.id, createdAt: c.createdAt, modelVersion: c.result.modelVersion, dataVersion: c.result.dataVersion, bestPaybackYears: bestPayback(c.result) }))
    return ok(list)
  },

  'GET /calculations/:id': (ctx) => {
    const { id, createdAt, request, result } = ownCalculation(ctx)
    return ok({ id, createdAt, request, result })
  },

  'GET /calculations/:id/report.pdf': (ctx) => {
    const calc = ownCalculation(ctx)
    return ok(new Blob([`%PDF-1.4\n% Заглушка отчёта по расчёту ${calc.id}\n%%EOF\n`], { type: 'application/pdf' }))
  },

  'GET /calculations/:id/export.xlsx': (ctx) => {
    const calc = ownCalculation(ctx)
    return ok(new Blob([`Заглушка выгрузки Excel по расчёту ${calc.id}\n`], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }))
  },
}

// ---------- Маршрутизация ----------

interface CompiledRoute {
  method: string
  regex: RegExp
  keys: string[]
  handler: Handler
}

const compiled: CompiledRoute[] = Object.entries(routes).map(([key, handler]) => {
  const [method, pattern] = key.split(' ') as [string, string]
  const keys: string[] = []
  const source = pattern
    .split('/')
    .map((part) => {
      if (!part.startsWith(':')) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      keys.push(part.slice(1))
      return '([^/]+)'
    })
    .join('/')
  return { method, regex: new RegExp(`^${source}$`), keys, handler }
})

export function handleMockRequest(req: MockRequest): MockResponse {
  const url = new URL(req.url, 'http://mock.local')
  const path = url.pathname.replace(/\/+$/, '') || '/'
  try {
    for (const route of compiled) {
      if (route.method !== req.method) continue
      const match = route.regex.exec(path)
      if (!match) continue
      const params: Record<string, string> = {}
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1]!)))
      return route.handler({ params, query: url.searchParams, body: req.body, user: userByToken(req.token) })
    }
    throw new MockFail(404, 'NOT_FOUND', `Адрес ${req.method} ${path} не найден`)
  } catch (error) {
    if (error instanceof MockFail) return { status: error.body.status, body: error.body }
    const title = error instanceof Error ? error.message : 'Неизвестная ошибка мок-сервера'
    return { status: 500, body: { status: 500, code: 'SERVER_ERROR', title } }
  }
}
