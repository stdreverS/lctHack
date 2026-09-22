import { describe, expect, it } from 'vitest'
import { DEFAULT_AFTER_LOGIN, safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('пропускает внутренние пути с query и hash', () => {
    expect(safeRedirect('/app/projects/42')).toBe('/app/projects/42')
    expect(safeRedirect('/catalog?q=amr#top')).toBe('/catalog?q=amr#top')
    expect(safeRedirect(['/admin/robots'])).toBe('/admin/robots')
  })

  it('внешние адреса и мусор → адрес по умолчанию', () => {
    for (const bad of ['//evil.ru', '/\\evil.ru', 'https://evil.ru', 'app', '', null, undefined, 42, []]) {
      expect(safeRedirect(bad)).toBe(DEFAULT_AFTER_LOGIN)
    }
  })

  it('не возвращает на страницы входа и регистрации', () => {
    expect(safeRedirect('/login?redirect=/x')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirect('/register')).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('свой адрес по умолчанию', () => {
    expect(safeRedirect(undefined, '/')).toBe('/')
  })
})
