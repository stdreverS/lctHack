import { describe, expect, it } from 'vitest'
import type { ApiError } from '@/types/api'
import { describeError, isApiError, splitServerErrors } from './errors'

const apiError = (e: Partial<ApiError>): ApiError => ({ status: 400, code: 'VALIDATION_ERROR', title: '', ...e })

describe('isApiError', () => {
  it('распознаёт объект ошибки API', () => {
    expect(isApiError(apiError({}))).toBe(true)
    expect(isApiError(new Error('x'))).toBe(false)
    expect(isApiError(null)).toBe(false)
    expect(isApiError({ status: 500, code: 'WHATEVER' })).toBe(false)
  })
})

describe('describeError', () => {
  it('заголовок по коду, описание — русская фраза сервера', () => {
    const t = describeError(apiError({ status: 409, code: 'CONFLICT', title: 'Пользователь с такой почтой уже зарегистрирован' }))
    expect(t.title).toBe('Такие данные уже существуют')
    expect(t.description).toBe('Пользователь с такой почтой уже зарегистрирован')
  })

  it('английская фраза сервера заменяется общим советом', () => {
    const t = describeError(apiError({ code: 'VALIDATION_ERROR', title: 'One or more validation errors occurred.' }))
    expect(t.description).toBe('Исправьте отмеченные поля и повторите действие.')
  })

  it('фраза, повторяющая заголовок, не дублируется', () => {
    const t = describeError(apiError({ status: 0, code: 'NETWORK_ERROR', title: 'Нет связи с сервером' }))
    expect(t.description).toMatch(/подключение/)
  })

  it('не ApiError → ошибка сервера', () => {
    expect(describeError(new TypeError('boom')).code).toBe('SERVER_ERROR')
    expect(describeError(undefined).title).toBe('Ошибка на сервере')
  })
})

describe('splitServerErrors', () => {
  const fields = ['email', 'password', 'name'] as const

  it('ошибки известных полей — к полям, без общего блока', () => {
    const r = splitServerErrors(apiError({ errors: [{ field: 'password', message: 'Пароль короче 8 символов', hint: 'Добавьте цифры' }] }), fields)
    expect(r.fieldErrors).toEqual({ password: 'Пароль короче 8 символов. Добавьте цифры' })
    expect(r.showAlert).toBe(false)
  })

  it('неизвестное поле → общий блок', () => {
    const r = splitServerErrors(apiError({ errors: [{ field: 'email', message: 'a' }, { field: 'captcha', message: 'b' }] }), fields)
    expect(r.fieldErrors).toEqual({ email: 'a' })
    expect(r.showAlert).toBe(true)
  })

  it('ошибка без errors → только общий блок', () => {
    const r = splitServerErrors(apiError({ status: 401, code: 'INVALID_CREDENTIALS' }), fields)
    expect(r.fieldErrors).toEqual({})
    expect(r.showAlert).toBe(true)
  })

  it('берётся первое сообщение поля', () => {
    const r = splitServerErrors(apiError({ errors: [{ field: 'email', message: 'первое' }, { field: 'email', message: 'второе' }] }), fields)
    expect(r.fieldErrors.email).toBe('первое')
  })
})
