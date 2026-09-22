import { describe, expect, it } from 'vitest'
import { ApiError, toApiError } from './http'

describe('toApiError', () => {
  it('берёт code, title и errors из тела ответа', () => {
    const err = toApiError(400, {
      code: 'VALIDATION_ERROR',
      title: 'Проверьте данные',
      errors: [{ field: 'password', message: 'Короткий пароль' }],
    })
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toBeInstanceOf(Error)
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', title: 'Проверьте данные', message: 'Проверьте данные' })
    expect(err.errors).toEqual([{ field: 'password', message: 'Короткий пароль' }])
  })

  it('без code определяет его по статусу и подставляет русский заголовок', () => {
    expect(toApiError(401, null).code).toBe('AUTH_REQUIRED')
    expect(toApiError(403, {}).code).toBe('FORBIDDEN')
    expect(toApiError(404, 'Not Found').code).toBe('NOT_FOUND')
    expect(toApiError(409, {}).code).toBe('CONFLICT')
    expect(toApiError(502, {}).code).toBe('SERVER_ERROR')
    expect(toApiError(500, {}).title).toMatch(/Ошибка на сервере/)
  })

  it('неизвестный code заменяется кодом по статусу', () => {
    expect(toApiError(404, { code: 'SOMETHING' }).code).toBe('NOT_FOUND')
  })

  it('словарь ошибок ASP.NET превращается в FieldError[] с camelCase', () => {
    const err = toApiError(400, { title: 'One or more validation errors occurred.', errors: { Email: ['Неверный формат'], Password: ['Коротко', 'Нет цифр'] } })
    expect(err.errors).toEqual([
      { field: 'email', message: 'Неверный формат' },
      { field: 'password', message: 'Коротко' },
      { field: 'password', message: 'Нет цифр' },
    ])
  })

  it('без errors поле отсутствует', () => {
    expect(toApiError(404, {}).errors).toBeUndefined()
  })
})
