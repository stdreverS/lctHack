// Форма робота в разделе «Управление каталогом»: поля по группам ТЗ, проверка
// обязательных полей и диапазонов, преобразование Robot ⇄ значения формы ⇄ RobotInput.
import type { Robot, RobotInput, RobotSpecs } from '@/types/api'
import { formatNumber } from './format'

type SpecKey = keyof RobotSpecs
type NumberSpecKey = Exclude<SpecKey, 'navigation'>

export interface RobotForm {
  name: string
  manufacturer: string
  solutionType: string
  solutionTypeName: string
  country: string
  payloadKg: number | null
  speedMps: number | null
  perfOpsPerHour: number | null
  autonomyH: number | null
  chargeTimeH: number | null
  positioningMm: number | null
  navigation: string
  minAisleM: number | null
  widthM: number | null
  lengthM: number | null
  heightM: number | null
  price: number | null
  raasMonthlyPrice: number | null
  maintenancePerYear: number | null
  lifeYears: number | null
  objectTypes: string[]
  availability: string
  sourceUrl: string
  /** ГГГГ-ММ-ДД или пусто. */
  sourceDate: string
  confirmed: boolean
}

export type RobotFormKey = keyof RobotForm
export type RobotFieldKind = 'text' | 'number' | 'integer' | 'solutionType' | 'objectTypes' | 'url' | 'date' | 'boolean'

export interface RobotFieldDef {
  key: RobotFormKey
  /** Имя поля в API — по нему сервер сообщает об ошибке (errors[].field). */
  path: string
  label: string
  kind: RobotFieldKind
  unit?: string
  required?: boolean
  min?: number
  max?: number
  maxLength?: number
  hint: string
  /** Пример для placeholder. */
  example?: string
}

export interface RobotFieldGroup {
  key: string
  label: string
  fields: RobotFieldDef[]
}

const SPEC_KEYS: readonly SpecKey[] = [
  'payloadKg', 'speedMps', 'perfOpsPerHour', 'autonomyH', 'chargeTimeH', 'positioningMm', 'navigation',
  'minAisleM', 'widthM', 'lengthM', 'heightM', 'lifeYears',
]

const spec = (key: NumberSpecKey, label: string, unit: string, min: number, max: number, hint: string, example: string, kind: RobotFieldKind = 'number'): RobotFieldDef => ({
  key, path: `specs.${key}`, label, kind, unit, min, max, hint, example,
})

/** Группы полей — те же, что в карточке робота (utils/robotSpecs.ts). */
export const ROBOT_FORM_GROUPS: RobotFieldGroup[] = [
  {
    key: 'identification',
    label: 'Идентификация',
    fields: [
      { key: 'name', path: 'name', label: 'Название', kind: 'text', required: true, maxLength: 200, hint: 'Модель так, как её называет производитель', example: 'Логимов AMR-600' },
      { key: 'manufacturer', path: 'manufacturer', label: 'Производитель', kind: 'text', required: true, maxLength: 200, hint: 'Компания-производитель или поставщик', example: 'Логимов Роботикс' },
      { key: 'solutionType', path: 'solutionType', label: 'Тип решения', kind: 'solutionType', required: true, hint: 'Выберите из списка или введите новый код латиницей — по нему каталог фильтрует роботов', example: 'amr' },
      { key: 'solutionTypeName', path: 'solutionTypeName', label: 'Название типа решения', kind: 'text', required: true, maxLength: 200, hint: 'Как тип показывается в каталоге', example: 'AMR — автономный мобильный робот' },
      { key: 'country', path: 'country', label: 'Страна производства', kind: 'text', maxLength: 100, hint: 'Необязательно', example: 'Россия' },
    ],
  },
  {
    key: 'technical',
    label: 'Технические характеристики',
    fields: [
      spec('payloadKg', 'Грузоподъёмность', 'кг', 1, 50_000, 'Максимальная масса груза', '600'),
      spec('speedMps', 'Скорость', 'м/с', 0.05, 10, 'Рабочая скорость с грузом', '1,5'),
      spec('perfOpsPerHour', 'Производительность', 'опер./ч', 0.1, 10_000, 'Операций в час на одного робота — основа расчёта парка', '45'),
      spec('autonomyH', 'Автономность', 'ч', 0.1, 72, 'Работа от одной зарядки', '10'),
      spec('chargeTimeH', 'Время зарядки', 'ч', 0.05, 24, 'Полная зарядка', '1,5'),
      spec('positioningMm', 'Точность позиционирования', 'мм', 0.1, 1000, 'Отклонение при остановке', '10'),
      { key: 'navigation', path: 'specs.navigation', label: 'Навигация', kind: 'text', maxLength: 200, hint: 'Способ навигации', example: 'Лидар, SLAM' },
    ],
  },
  {
    key: 'infrastructure',
    label: 'Требования к инфраструктуре',
    fields: [
      spec('minAisleM', 'Минимальная ширина прохода', 'м', 0.3, 10, 'Проверяется при подборе по ширине проходов объекта', '1,2'),
      spec('widthM', 'Ширина', 'м', 0.1, 20, 'Габарит робота', '0,95'),
      spec('lengthM', 'Длина', 'м', 0.1, 20, 'Габарит робота', '1,3'),
      spec('heightM', 'Высота', 'м', 0.05, 20, 'Габарит робота', '0,3'),
    ],
  },
  {
    key: 'economics',
    label: 'Экономика',
    fields: [
      { key: 'price', path: 'price', label: 'Цена покупки', kind: 'number', unit: '₽', required: true, min: 1, max: 1_000_000_000, hint: 'За один робот, с НДС', example: '4 200 000' },
      { key: 'raasMonthlyPrice', path: 'raasMonthlyPrice', label: 'Аренда (RaaS) в месяц', kind: 'number', unit: '₽', min: 1, max: 100_000_000, hint: 'За один робот, с НДС. Пусто — аренда не предлагается', example: '115 000' },
      { key: 'maintenancePerYear', path: 'maintenancePerYear', label: 'Обслуживание в год', kind: 'number', unit: '₽', required: true, min: 0, max: 100_000_000, hint: 'За один робот, с НДС; 0 — входит в цену', example: '320 000' },
      spec('lifeYears', 'Срок службы', 'лет', 1, 30, 'Используется в расчёте совокупной стоимости владения', '7', 'integer'),
    ],
  },
  {
    key: 'applicability',
    label: 'Применимость',
    fields: [
      { key: 'objectTypes', path: 'objectTypes', label: 'Типы объектов', kind: 'objectTypes', required: true, hint: 'Где робот участвует в подборе', example: 'Выберите один или несколько' },
      { key: 'availability', path: 'availability', label: 'Доступность поставки', kind: 'text', maxLength: 200, hint: 'Срок или условия поставки', example: 'Поставка 8–10 недель' },
    ],
  },
  {
    key: 'quality',
    label: 'Качество данных',
    fields: [
      { key: 'sourceUrl', path: 'sourceUrl', label: 'Источник (ссылка)', kind: 'url', maxLength: 500, hint: 'Страница производителя, прайс или коммерческое предложение', example: 'https://example.com/robot' },
      { key: 'sourceDate', path: 'sourceDate', label: 'Дата данных', kind: 'date', hint: 'Когда получены цена и характеристики', example: 'Выберите дату' },
      { key: 'confirmed', path: 'confirmed', label: 'Данные подтверждены источником', kind: 'boolean', hint: 'Без подтверждения значения показываются как допущение' },
    ],
  },
]

export const ROBOT_FORM_FIELDS: RobotFieldDef[] = ROBOT_FORM_GROUPS.flatMap((g) => g.fields)

export function emptyRobotForm(): RobotForm {
  return {
    name: '', manufacturer: '', solutionType: '', solutionTypeName: '', country: '',
    payloadKg: null, speedMps: null, perfOpsPerHour: null, autonomyH: null, chargeTimeH: null, positioningMm: null,
    navigation: '', minAisleM: null, widthM: null, lengthM: null, heightM: null,
    price: null, raasMonthlyPrice: null, maintenancePerYear: null, lifeYears: null,
    objectTypes: [], availability: '', sourceUrl: '', sourceDate: '', confirmed: false,
  }
}

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: string | null | undefined): string => v ?? ''
const textOrNull = (v: string): string | null => (v.trim() ? v.trim() : null)

export function robotToForm(robot: Robot): RobotForm {
  const s = robot.specs
  return {
    name: robot.name, manufacturer: robot.manufacturer,
    solutionType: robot.solutionType, solutionTypeName: robot.solutionTypeName, country: str(robot.country),
    payloadKg: num(s.payloadKg), speedMps: num(s.speedMps), perfOpsPerHour: num(s.perfOpsPerHour),
    autonomyH: num(s.autonomyH), chargeTimeH: num(s.chargeTimeH), positioningMm: num(s.positioningMm),
    navigation: str(s.navigation), minAisleM: num(s.minAisleM),
    widthM: num(s.widthM), lengthM: num(s.lengthM), heightM: num(s.heightM),
    price: num(robot.price), raasMonthlyPrice: num(robot.raasMonthlyPrice),
    maintenancePerYear: num(robot.maintenancePerYear), lifeYears: num(s.lifeYears),
    objectTypes: [...robot.objectTypes], availability: str(robot.availability),
    sourceUrl: str(robot.sourceUrl), sourceDate: str(robot.sourceDate).slice(0, 10), confirmed: robot.confirmed,
  }
}

/** Значения формы → тело POST/PUT /robots. Вызывать после успешной проверки. */
export function formToRobotInput(form: RobotForm): RobotInput {
  const specs: RobotSpecs = {}
  for (const key of SPEC_KEYS) {
    const value = form[key]
    ;(specs as Record<string, unknown>)[key] = typeof value === 'string' ? textOrNull(value) : value
  }
  return {
    name: form.name.trim(),
    manufacturer: form.manufacturer.trim(),
    solutionType: form.solutionType.trim(),
    solutionTypeName: form.solutionTypeName.trim(),
    objectTypes: [...form.objectTypes],
    country: textOrNull(form.country),
    availability: textOrNull(form.availability),
    price: form.price ?? 0,
    raasMonthlyPrice: form.raasMonthlyPrice,
    maintenancePerYear: form.maintenancePerYear ?? 0,
    specs,
    sourceUrl: textOrNull(form.sourceUrl),
    sourceDate: textOrNull(form.sourceDate),
    confirmed: form.confirmed,
  }
}

const CODE_RE = /^[a-z][a-z0-9_-]{1,31}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.')
  } catch {
    return false
  }
}

function rangeText(def: RobotFieldDef): string {
  const unit = def.unit ? ` ${def.unit}` : ''
  return `от ${formatNumber(def.min)} до ${formatNumber(def.max)}${unit}`
}

function checkField(def: RobotFieldDef, form: RobotForm, today: string): string | null {
  const value = form[def.key]
  if (def.kind === 'boolean') return null
  if (def.kind === 'objectTypes') {
    return (value as string[]).length ? null : 'Выберите хотя бы один тип объекта — иначе робот не попадёт в подбор'
  }
  if (typeof value === 'number' || value === null) {
    if (value === null) return def.required ? `Заполните поле «${def.label}»` : null
    if (def.kind === 'integer' && !Number.isInteger(value)) return `Введите целое число ${rangeText(def)}`
    if ((def.min !== undefined && value < def.min) || (def.max !== undefined && value > def.max)) {
      return `Значение должно быть ${rangeText(def)}`
    }
    return null
  }
  const text = (value as string).trim()
  if (!text) return def.required ? `Заполните поле «${def.label}»` : null
  if (def.maxLength && text.length > def.maxLength) return `Не длиннее ${def.maxLength} символов — сократите текст`
  if (def.kind === 'solutionType' && !CODE_RE.test(text)) {
    return 'Код — строчные латинские буквы, цифры, «-» или «_», от 2 символов, например amr'
  }
  if (def.kind === 'url' && !isHttpUrl(text)) return 'Введите полную ссылку, начиная с https://, например https://example.com/robot'
  if (def.kind === 'date') {
    if (!DATE_RE.test(text) || Number.isNaN(new Date(text).getTime())) return 'Выберите дату в календаре'
    if (text > today) return 'Дата данных не может быть в будущем'
  }
  return null
}

/** Ошибки формы по полям; пустой объект — форма заполнена верно. */
export function validateRobotForm(form: RobotForm, today: Date = new Date()): Partial<Record<RobotFormKey, string>> {
  const two = (n: number) => String(n).padStart(2, '0')
  const day = `${today.getFullYear()}-${two(today.getMonth() + 1)}-${two(today.getDate())}`
  const errors: Partial<Record<RobotFormKey, string>> = {}
  for (const def of ROBOT_FORM_FIELDS) {
    const message = checkField(def, form, day)
    if (message) errors[def.key] = message
  }
  // Подтверждённые данные должны ссылаться на проверяемый источник.
  if (form.confirmed) {
    if (!form.sourceUrl.trim()) errors.sourceUrl ??= 'Для подтверждённых данных укажите ссылку на источник или снимите отметку «подтверждено»'
    if (!form.sourceDate.trim()) errors.sourceDate ??= 'Для подтверждённых данных укажите дату получения данных'
  }
  return errors
}

/** Ошибки сервера (errors[].field — имя поля API) → ключи формы. */
export function serverFieldToFormKey(field: string): RobotFormKey | null {
  return ROBOT_FORM_FIELDS.find((f) => f.path === field)?.key ?? null
}

/** Поиск в таблице администратора: по названию, производителю и типу решения, без учёта регистра. */
export function searchRobots<T extends Pick<Robot, 'name' | 'manufacturer' | 'solutionTypeName'>>(list: readonly T[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [...list]
  return list.filter((r) => {
    const text = `${r.name} ${r.manufacturer} ${r.solutionTypeName}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
}
