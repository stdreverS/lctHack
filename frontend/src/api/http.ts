// Единственное место с fetch: префикс /api/v1, токен, разбор ошибок, моки.
import { useAuthStore } from '@/stores/auth'
import type { ApiError as ApiErrorBody, ErrorCode, FieldError } from '@/types/api'

export const API_PREFIX = '/api/v1'
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
const MOCK_DELAY_MS = 300

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  body?: unknown
  query?: Record<string, QueryValue>
  responseType?: 'json' | 'blob'
}

/** Ошибка API в формате контракта (ProblemDetails). */
export class ApiError extends Error implements ApiErrorBody {
  readonly status: number
  readonly code: ErrorCode
  readonly title: string
  readonly errors?: FieldError[]

  constructor(body: ApiErrorBody) {
    super(body.title)
    this.name = 'ApiError'
    this.status = body.status
    this.code = body.code
    this.title = body.title
    if (body.errors) this.errors = body.errors
  }
}

const ERROR_CODES: readonly ErrorCode[] = [
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'CALCULATION_ERROR',
  'SERVER_ERROR',
  'NETWORK_ERROR',
]

const DEFAULT_TITLES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Проверьте введённые данные',
  AUTH_REQUIRED: 'Войдите в систему, чтобы продолжить',
  INVALID_CREDENTIALS: 'Неверная почта или пароль',
  FORBIDDEN: 'Недостаточно прав для этого действия',
  NOT_FOUND: 'Запрашиваемые данные не найдены',
  CONFLICT: 'Данные конфликтуют с уже существующими',
  CALCULATION_ERROR: 'Не удалось выполнить расчёт — проверьте параметры объекта',
  SERVER_ERROR: 'Ошибка на сервере. Повторите попытку позже',
  NETWORK_ERROR: 'Сервер недоступен. Проверьте подключение к сети и повторите попытку',
}

function codeByStatus(status: number): ErrorCode {
  switch (status) {
    case 0:
      return 'NETWORK_ERROR'
    case 400:
    case 422:
      return 'VALIDATION_ERROR'
    case 401:
      return 'AUTH_REQUIRED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    default:
      return 'SERVER_ERROR'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Поля ошибок: массив FieldError (контракт) или словарь ASP.NET { Field: [сообщения] }. */
function parseFieldErrors(raw: unknown): FieldError[] | undefined {
  if (Array.isArray(raw)) {
    const list = raw.filter(
      (e): e is FieldError =>
        isRecord(e) && typeof e.field === 'string' && typeof e.message === 'string',
    )
    return list.length ? list : undefined
  }
  if (isRecord(raw)) {
    const list: FieldError[] = []
    for (const [key, messages] of Object.entries(raw)) {
      const field = key.charAt(0).toLowerCase() + key.slice(1)
      const texts = Array.isArray(messages) ? messages : [messages]
      for (const message of texts) {
        if (typeof message === 'string') list.push({ field, message })
      }
    }
    return list.length ? list : undefined
  }
  return undefined
}

/** Приводит статус и тело ответа сервера к ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  const data = isRecord(body) ? body : {}
  const code =
    typeof data.code === 'string' && (ERROR_CODES as readonly string[]).includes(data.code)
      ? (data.code as ErrorCode)
      : codeByStatus(status)
  const title =
    typeof data.title === 'string' && data.title.trim() ? data.title : DEFAULT_TITLES[code]
  const errors = parseFieldErrors(data.errors)
  return new ApiError({ status, code, title, ...(errors ? { errors } : {}) })
}

function networkError(): ApiError {
  return new ApiError({ status: 0, code: 'NETWORK_ERROR', title: DEFAULT_TITLES.NETWORK_ERROR })
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

function isMockOffline(): boolean {
  try {
    return localStorage.getItem('mockOffline') === '1'
  } catch {
    return false
  }
}

interface RawResponse {
  status: number
  body: unknown
}

async function sendMock(
  method: HttpMethod,
  url: string,
  body: unknown,
  token: string | null,
): Promise<RawResponse> {
  const { handleMockRequest } = await import('@/mocks/router')
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
  if (isMockOffline()) throw networkError()
  // Копия через JSON, как при реальной передаче по сети: компоненты не должны менять данные мока.
  const payload = body === undefined ? undefined : JSON.parse(JSON.stringify(body))
  const response = handleMockRequest({ method, url, body: payload, token })
  const resBody =
    response.body instanceof Blob || response.body === undefined
      ? response.body
      : JSON.parse(JSON.stringify(response.body))
  return { status: response.status, body: resBody }
}

async function sendFetch(
  method: HttpMethod,
  url: string,
  body: unknown,
  token: string | null,
  responseType: 'json' | 'blob',
): Promise<RawResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(API_PREFIX + url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw networkError()
  }

  if (res.status === 204) return { status: 204, body: undefined }
  if (res.ok && responseType === 'blob') return { status: res.status, body: await res.blob() }

  const text = await res.text()
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  return { status: res.status, body: parsed }
}

async function redirectToLogin(): Promise<void> {
  // Ленивый импорт: роутер импортирует экраны, а они — api; так нет циклической зависимости.
  const { default: router } = await import('@/router')
  const current = router.currentRoute.value
  if (current.path === '/login') return
  await router.push({ path: '/login', query: { redirect: current.fullPath } })
}

export async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const auth = useAuthStore()
  const url = buildUrl(path, options.query)
  const responseType = options.responseType ?? 'json'

  const { status, body } = USE_MOCKS
    ? await sendMock(method, url, options.body, auth.token)
    : await sendFetch(method, url, options.body, auth.token, responseType)

  if (status >= 200 && status < 300) return body as T

  const error = toApiError(status, body)
  // 401 на защищённый запрос: сессия недействительна → выход и переход ко входу.
  // Для /auth/* 401 означает неверный пароль — остаёмся на форме.
  if (status === 401 && !path.startsWith('/auth/')) {
    auth.logout()
    void redirectToLogin()
  }
  throw error
}

export function get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  return request<T>('GET', path, { query })
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, { body })
}

export function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, { body })
}

export function del(path: string): Promise<void> {
  return request<void>('DELETE', path)
}

export function getBlob(path: string): Promise<Blob> {
  return request<Blob>('GET', path, { responseType: 'blob' })
}
