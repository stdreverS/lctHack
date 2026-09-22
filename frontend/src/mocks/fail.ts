import type { ApiError, ErrorCode, FieldError } from '@/types/api'

/** Ошибка мок-сервера; mocks/router.ts превращает её в ответ ProblemDetails. */
export class MockFail extends Error {
  readonly body: ApiError

  constructor(status: number, code: ErrorCode, title: string, errors?: FieldError[]) {
    super(title)
    this.body = { status, code, title, ...(errors ? { errors } : {}) }
  }
}
