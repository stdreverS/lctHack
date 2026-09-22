export const DEFAULT_AFTER_LOGIN = '/app/projects'

/**
 * Безопасный адрес возврата из ?redirect=: только внутренний путь приложения.
 * Внешние адреса («//evil.ru», «https://…») и страницы входа заменяются адресом по умолчанию.
 */
export function safeRedirect(value: unknown, fallback = DEFAULT_AFTER_LOGIN): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  const path = raw.split(/[?#]/)[0] ?? ''
  if (path === '/login' || path === '/register') return fallback
  return raw
}
