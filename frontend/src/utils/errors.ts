// Понятные тексты ошибок API и раскладка ошибок сервера по полям формы.
import type { ApiError, ErrorCode } from '@/types/api'

export interface ErrorText {
  code: ErrorCode
  title: string
  description: string
}

const TEXTS: Record<ErrorCode, { title: string; description: string }> = {
  VALIDATION_ERROR: { title: 'Проверьте введённые данные', description: 'Исправьте отмеченные поля и повторите действие.' },
  AUTH_REQUIRED: { title: 'Нужно войти в систему', description: 'Сессия истекла или вы не вошли. Войдите и повторите действие.' },
  INVALID_CREDENTIALS: { title: 'Неверная почта или пароль', description: 'Проверьте раскладку клавиатуры и Caps Lock. Если у вас нет учётной записи — зарегистрируйтесь.' },
  FORBIDDEN: { title: 'Недостаточно прав', description: 'Это действие доступно только администратору. Обратитесь к администратору платформы.' },
  NOT_FOUND: { title: 'Данные не найдены', description: 'Возможно, запись удалена или ссылка устарела. Вернитесь к списку и выберите запись заново.' },
  CONFLICT: { title: 'Такие данные уже существуют', description: 'Измените введённые значения и повторите попытку.' },
  CALCULATION_ERROR: { title: 'Не удалось выполнить расчёт', description: 'Проверьте параметры объекта и сценарии, затем запустите расчёт снова.' },
  SERVER_ERROR: { title: 'Ошибка на сервере', description: 'Повторите попытку через минуту. Если ошибка повторяется — сообщите администратору.' },
  NETWORK_ERROR: { title: 'Нет связи с сервером', description: 'Проверьте подключение к сети или VPN и повторите попытку.' },
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.status === 'number' && typeof v.code === 'string' && v.code in TEXTS
}

const CYRILLIC = /[а-яё]/i

/**
 * Заголовок — всегда по коду (гарантированно на русском).
 * Описание — конкретная фраза сервера, если она на русском и не повторяет заголовок; иначе общий совет.
 */
export function describeError(error: unknown): ErrorText {
  const code: ErrorCode = isApiError(error) ? error.code : 'SERVER_ERROR'
  const text = TEXTS[code]
  const serverTitle = isApiError(error) ? error.title.trim() : ''
  const useServer = serverTitle !== '' && CYRILLIC.test(serverTitle) && serverTitle !== text.title
  return { code, title: text.title, description: useServer ? serverTitle : text.description }
}

export interface SplitErrors {
  /** Сообщения для полей формы: { email: 'Введите корректный адрес почты' } */
  fieldErrors: Record<string, string>
  /** Нужно ли показать общий ErrorAlert (ошибка не относится к известным полям). */
  showAlert: boolean
}

/** Раскладывает ошибку сервера: errors[].field → поля формы, остальное — в общий блок. */
export function splitServerErrors(error: unknown, fields: readonly string[]): SplitErrors {
  const fieldErrors: Record<string, string> = {}
  const list = isApiError(error) ? (error.errors ?? []) : []
  let unmatched = 0
  for (const item of list) {
    if (fields.includes(item.field)) {
      fieldErrors[item.field] ??= item.hint ? `${item.message}. ${item.hint}` : item.message
    } else {
      unmatched++
    }
  }
  const showAlert = list.length === 0 || unmatched > 0
  return { fieldErrors, showAlert }
}
