import { describe, expect, it } from 'vitest'
import type { ApiError } from '@/types/api'
import { describeAppError, describeError, isApiError, splitServerErrors } from './errors'

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

  it('501 — функция не реализована, а не сбой сервера', () => {
    const withText = describeError(apiError({ status: 501, code: 'SERVER_ERROR', title: 'PDF на сервере пока не формируется' }))
    expect(withText).toEqual({ code: 'SERVER_ERROR', title: 'Функция пока недоступна', description: 'PDF на сервере пока не формируется' })
    const bare = describeError(apiError({ status: 501, code: 'SERVER_ERROR', title: 'Not Implemented' }))
    expect(bare.description).toMatch(/ещё не поддерживает/)
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

describe('describeAppError', () => {
  it('ошибка API — те же тексты, что у ErrorAlert', () => {
    expect(describeAppError(apiError({ status: 0, code: 'NETWORK_ERROR', title: '' })).title).toBe('Нет связи с сервером')
  })

  it('не загрузился модуль страницы — предлагает обновить страницу', () => {
    const t = describeAppError(new TypeError('Failed to fetch dynamically imported module: /assets/DemoView-1a2b.js'))
    expect(t.title).toBe('Не удалось загрузить страницу')
  })

  it('прочая ошибка — общий текст без «ошибки на сервере»', () => {
    const t = describeAppError(new TypeError("Cannot read properties of undefined (reading 'metrics')"))
    expect(t.title).toBe('На странице произошла ошибка')
    expect(t.description).toMatch(/Обновите страницу/)
  })
})
