# Платформа подбора роботизированных решений — хакатон ФЦ БАС

Веб-платформа для экспресс-предынвестиционной оценки роботизации объекта:
выбор объекта → параметры → подбор роботов → сравнение → экономика (3 сценария) →
what-if → 2D-симуляция → экспорт. Интерфейс — для руководителей и аналитиков,
не для программистов.

Подробности: docs/architecture.md. При расхождении этого файла и кода — прав этот файл,
сообщи о расхождении.

## 1. Зоны ответственности

- Я (Амир): frontend/, backend/src/Robo.Core/, backend/tests/, backend/config/, docs/,
  docker-compose.yml.
- Напарник: backend/src/Robo.Api/ и backend/Dockerfile. НЕ ТРОГАТЬ эти файлы.
- Если задача требует изменений в зоне напарника — остановись и скажи, что именно нужно.

## 2. Стек фронтенда

- Vue 3, `<script setup lang="ts">`, Composition API. TypeScript strict. Vite.
- Vue Router, Pinia, Element Plus (локаль ru), Chart.js через vue-chartjs.
- Шрифт: Golos Text через пакет @fontsource/golos-text (локально, без CDN — демо должно
  работать без интернета).
- 2D-симуляция: чистый Canvas 2D, без библиотек.
- Новые npm-пакеты — только если без них задача заметно сложнее. Каждый новый пакет
  назови и объясни в ответе.

## 3. Структура frontend/src

```
types/api.ts        ВСЕ типы контракта API (раздел 5). Единственный источник типов API.
types/sim.ts        типы симуляции
api/http.ts         единственное место с fetch: префикс /api/v1, токен, ошибки, моки
api/auth.ts, objectTypes.ts, robots.ts, projects.ts, calculations.ts
mocks/router.ts     маршрутизатор моков "METHOD /path" → обработчик
mocks/data/*.ts     данные моков с явными типами из types/api.ts
router/index.ts     маршруты, meta { auth?: boolean, role?: 'admin' }, guard
stores/auth.ts      токен и пользователь (localStorage), login/register/logout
stores/wizard.ts    состояние мастера (guest | project)
layouts/            PublicLayout, AppLayout, AdminLayout
views/              экраны (раздел 6)
components/wizard/  WizardShell + Step*.vue
components/common/  DynamicForm, MetricCard, CheckList, ScoreBreakdown, SourceBadge,
                    StatusTag, ErrorAlert, EmptyState
components/charts/  CashflowChart, ScenarioBarChart, SensitivityChart
components/sim/     SimulationCanvas, SimControls, SimKpiPanel
sim/                random.ts, engine.ts (чистая функция), renderer.ts
utils/format.ts     форматирование чисел, рублей, процентов, дат (ru-RU)
styles/             tokens.css (дизайн-токены), main.css
```

## 4. Правила кода

- Никаких fetch/axios в компонентах — только функции из src/api/*.ts.
- Типы ответов API не объявлять в компонентах — только импорт из types/api.ts.
- Экономику, ROI, окупаемость, подбор НЕ считать на фронтенде. Только отображать ответ
  сервера. Исключение — 2D-симуляция (src/sim/engine.ts).
- Формы параметров объекта строятся по ObjectType.fields компонентом DynamicForm.
  Не хардкодить поля конкретных типов объектов.
- Мастер из 8 шагов — один компонент WizardShell для гостя (/demo, без сохранения)
  и пользователя (/app/projects/:id, с сохранением).
- Компоненты — не длиннее ~250 строк; если больше — разбей.
- Изменение types/api.ts = изменение контракта с бэкендом. Не делай его молча: в ответе
  отдельно перечисли, что изменилось.

## 5. Контракт API (v1)

Общее: префикс /api/v1; JSON; ключи camelCase; id — строки (UUID); даты — ISO 8601 UTC;
деньги — рубли с НДС, числом; токен — заголовок `Authorization: Bearer <token>`.

```ts
// ---------- Ошибки (формат ProblemDetails) ----------
type ErrorCode = 'VALIDATION_ERROR' | 'AUTH_REQUIRED' | 'INVALID_CREDENTIALS' | 'FORBIDDEN'
  | 'NOT_FOUND' | 'CONFLICT' | 'CALCULATION_ERROR' | 'SERVER_ERROR' | 'NETWORK_ERROR'
interface FieldError { field: string; message: string; hint?: string }
interface ApiError { status: number; code: ErrorCode; title: string; errors?: FieldError[] }
// NETWORK_ERROR (status 0) формирует сам фронтенд, если сервер недоступен.

// ---------- Авторизация ----------
type Role = 'user' | 'admin'
interface User { id: string; email: string; name: string; role: Role }
interface LoginRequest { email: string; password: string }
interface RegisterRequest { email: string; password: string; name: string }
interface AuthResponse { token: string; user: User }
// POST /auth/login     LoginRequest    → AuthResponse   (401 INVALID_CREDENTIALS)
// POST /auth/register  RegisterRequest → AuthResponse   (409 CONFLICT, 400 VALIDATION_ERROR)

// ---------- Типы объектов ----------
type ParamValue = number | string | boolean | null
type Params = Record<string, ParamValue>
interface ParamField {
  key: string; label: string; group: string
  type: 'number' | 'integer' | 'enum' | 'boolean' | 'string'
  unit?: string; required: boolean; min?: number; max?: number
  options?: { value: string; label: string }[]
  default?: ParamValue; example?: ParamValue; hint?: string
  defaultSource?: { source: string; confirmed: boolean }
}
interface Zone {
  id: string; type: 'receiving' | 'storage' | 'picking' | 'shipping' | 'charging' | 'other'
  label: string; rect: [number, number, number, number]   // x, y, ширина, высота, м
  slots?: number
}
interface Layout { widthM: number; heightM: number; zones: Zone[] }
interface ObjectType {
  code: string                       // 'warehouse' | 'airport' | 'hospital' | ...
  name: string; description: string
  processes: { code: string; name: string }[]
  groups: { key: string; label: string }[]
  fields: ParamField[]
  demoParams: Params
  layout: Layout | null              // null — симуляция для типа пока недоступна
}
// GET /object-types → ObjectType[]

// ---------- Каталог роботов ----------
interface RobotSpecs {
  payloadKg?: number | null; speedMps?: number | null; perfOpsPerHour?: number | null
  autonomyH?: number | null; chargeTimeH?: number | null; positioningMm?: number | null
  navigation?: string | null; minAisleM?: number | null
  widthM?: number | null; lengthM?: number | null; heightM?: number | null
  lifeYears?: number | null
}
interface Robot {
  id: string; name: string; manufacturer: string
  solutionType: string; solutionTypeName: string       // 'amr' / 'AMR — автономный мобильный робот'
  objectTypes: string[]; country: string | null; availability: string | null
  price: number; raasMonthlyPrice: number | null; maintenancePerYear: number
  specs: RobotSpecs
  sourceUrl: string | null; sourceDate: string | null; confirmed: boolean
}
type RobotInput = Omit<Robot, 'id'>
// GET    /robots?objectType=&solutionType=&q=&sort=  → Robot[]
// GET    /robots/{id}                               → Robot
// POST   /robots        RobotInput → Robot   (admin)
// PUT    /robots/{id}   RobotInput → Robot   (admin)
// DELETE /robots/{id}                → 204   (admin)

// ---------- Проекты ----------
interface Assumptions {
  horizonYears: number; workDaysPerYear: number; shiftsPerDay: number; hoursPerShift: number
  utilization: number; availability: number; reserveShare: number; staffReplacedShare: number
}
interface ProjectInput { name: string; objectType: string; params: Params; assumptions: Assumptions }
interface Project extends ProjectInput { id: string; createdAt: string; updatedAt: string }
interface ProjectSummary {
  id: string; name: string; objectType: string; updatedAt: string
  lastPaybackYears: number | null
}
// GET    /projects                 → ProjectSummary[]
// POST   /projects   ProjectInput  → Project
// GET    /projects/{id}            → Project
// PUT    /projects/{id} ProjectInput → Project
// DELETE /projects/{id}            → 204
// POST   /projects/{id}/copy       → Project

// ---------- Расчёт ----------
type ScenarioKind = 'baseline' | 'purchase' | 'raas'
interface ScenarioInput {
  id: string; kind: ScenarioKind; title: string
  robotId: string | null                      // null только для baseline
  overrides?: { robotCount?: number | null; unitPriceRub?: number | null }   // ручные правки
  raas?: { monthlyFeePerRobotRub: number; contractYears: number; setupRub: number }
}
type SensParam = 'equipmentPrice' | 'operationsVolume' | 'laborCost'
interface SimKpi {
  engineVersion: string; seed: number
  throughputPerHour: number; targetPerHour: number; achievedPercent: number
  avgUtilization: number; idleShare: number; chargingShare: number
  maxQueue: number; bottleneck: string; confirmsCalculation: boolean
}
interface CalcRequest {
  projectId: string | null          // null или без токена — расчёт гостя, не сохраняется
  objectType: string; processes: string[]; params: Params; assumptions: Assumptions
  scenarios: ScenarioInput[]        // может быть пустым: тогда считаются подбор и baseline
  sensitivity: { params: SensParam[]; deltas: number[] }   // deltas, напр. [-0.2,-0.1,0.1,0.2]
  simulation?: SimKpi | null
}

type CheckResult = 'pass' | 'fail' | 'unknown'
type RecStatus = 'recommended' | 'excluded' | 'needs_check'
interface Check {
  rule: string; label: string; critical: boolean; result: CheckResult
  required?: number | string | null; actual?: number | string | null; unit?: string | null
  message: string                   // готовая фраза на русском
}
interface ScoreFactor { factor: string; label: string; weight: number; value: number; contribution: number }
interface RecommendationItem {
  robotId: string; name: string; solutionType: string
  status: RecStatus; score: number | null
  checks: Check[]; scoreBreakdown: ScoreFactor[]; missingData: string[]
}
// Статус: есть критическая fail → excluded; иначе есть критическая unknown → needs_check;
// иначе recommended.

type MetricKey = 'robotCount' | 'capexRub' | 'opexAnnualRub' | 'opexDeltaRub'
  | 'annualEffectRub' | 'paybackYears' | 'roiPercent' | 'tcoRub'
interface Metric {
  label: string; value: number | null; unit: string
  formula: string                   // человекочитаемая формула
  breakdown?: { key: string; label: string; value: number; source?: string }[]
  inputs?: Record<string, number>
  overridden: boolean               // true — значение изменено вручную
}
interface EquipmentLine { item: string; qty: number; unitPriceRub: number; totalRub: number }
interface CashflowYear { year: number; capexRub: number; opexRub: number; effectRub: number; cumulativeRub: number }
interface Verdict {
  level: 'good' | 'moderate' | 'poor' | 'negative'   // до 3 лет / 3–5 / более 5 / не окупается
  label: string; interpretation: string; risks: string[]
}
interface ScenarioResult {
  id: string; kind: ScenarioKind; title: string; robotId: string | null
  equipment: EquipmentLine[]
  metrics: Record<MetricKey, Metric>
  cashflow: CashflowYear[]
  verdict: Verdict
}
interface SensitivityPoint { delta: number; paybackYears: number | null; roiPercent: number | null; annualEffectRub: number }
interface SensitivitySeries { scenarioId: string; param: SensParam; label: string; points: SensitivityPoint[] }
interface AssumptionRef { key: string; label: string; value: number | string; unit: string; source: string; confirmed: boolean }
interface CalcResult {
  calculationId: string | null      // null для гостя
  modelVersion: string; dataVersion: string; calculatedAt: string
  disclaimer: string                // «Предварительная оценка…»
  recommendation: RecommendationItem[]
  scenarios: ScenarioResult[]
  sensitivity: SensitivitySeries[]
  assumptionsUsed: AssumptionRef[]
}
interface CalculationSummary { id: string; createdAt: string; modelVersion: string; dataVersion: string; bestPaybackYears: number | null }
interface CalculationRecord { id: string; createdAt: string; request: CalcRequest; result: CalcResult }
// POST /calculations  CalcRequest → CalcResult            (гость или пользователь)
// GET  /projects/{id}/calculations → CalculationSummary[] (владелец)
// GET  /calculations/{id}          → CalculationRecord    (владелец)
// GET  /calculations/{id}/report.pdf   → файл PDF
// GET  /calculations/{id}/export.xlsx  → файл Excel
```

## 6. Экраны и маршруты

| Путь | Экран | Доступ |
|---|---|---|
| / | Приветствие: что делает платформа, 3 типа объектов, «Попробовать без регистрации», «Каталог», «Войти» | все |
| /login, /register | Вход, регистрация | все |
| /catalog, /catalog/:id | Каталог роботов (поиск, фильтры, сортировка, выбор до 3 для сравнения), карточка | все |
| /demo | Мастер в режиме гостя, без сохранения | все |
| /app/projects | Рабочая зона: список проектов, создать, копировать, удалить | user, admin |
| /app/projects/:id | Мастер проекта с сохранением и историей расчётов | владелец |
| /app/profile | Профиль: имя, почта, роль, выход | user, admin |
| /admin/robots | Управление каталогом: таблица, форма, удаление | admin |

Шаги мастера: 1 Объект → 2 Параметры → 3 Подбор → 4 Сравнение → 5 Экономика →
6 What-if → 7 Симуляция → 8 Экспорт.

## 7. Моки

- `VITE_USE_MOCKS=true` (frontend/.env.development) → http.ts отдаёт запрос в mocks/router.ts.
- Задержка ответа 300 мс, чтобы были видны состояния загрузки.
- Данные мока хранятся в памяти модуля (создание/удаление проектов работает до перезагрузки).
- Демо-учётки: user@demo.ru / Demo12345 (user), admin@demo.ru / Admin12345 (admin).
- Мок-токен: `mock-token:<userId>`; mocks/router.ts определяет по нему пользователя.
- Моки обязаны воспроизводить ошибки: неверный пароль → 401 INVALID_CREDENTIALS;
  занятая почта → 409 CONFLICT; пароль короче 8 символов → 400 VALIDATION_ERROR с
  errors[].field; запрос к /projects без токена → 401 AUTH_REQUIRED; к /robots POST не
  админом → 403 FORBIDDEN; несуществующий id → 404 NOT_FOUND.
- Специальная проверка сети: если в localStorage есть ключ `mockOffline=1`, http.ts
  возвращает NETWORK_ERROR — чтобы проверить экран ошибки.

## 8. UI и дизайн

- Весь текст на русском. Кнопки называют действие («Рассчитать», «Сохранить проект»),
  не «Отправить». Ошибки говорят, что не так и как исправить. Пустые экраны предлагают
  действие.
- У каждого поля ввода: единица измерения, подсказка (hint), пример (placeholder).
  Если значение по умолчанию взято из норматива — показать источник (SourceBadge).
- Корректная работа при 1366×768: без горизонтальной прокрутки страницы; широкие
  таблицы прокручиваются внутри себя.
- Числа: разделитель разрядов — пробел, рубли «12 400 000 ₽», проценты «31,5 %»,
  годы «2,4 года»; в таблицах — моноширинные цифры (font-variant-numeric: tabular-nums).
- Визуальный характер — инженерный инструмент для логистики, спокойный и плотный:
  - основа: холодный светлый фон #F4F6F7, текст #1E2A33, вторичный текст #5B6B77,
    границы #D5DCE1;
  - основной цвет — стальной синий #2F5D7C (кнопки, активные элементы);
  - акцент — «разметочный» жёлтый #F2B705, как напольная разметка склада: только для
    активного шага мастера, маршрутов роботов в симуляции и одной ключевой цифры на экране;
  - статусы: зелёный #2E8B57 (подходит / окупается до 3 лет), янтарный #C98A00
    (требует проверки / 3–5 лет), красный #C0392B (не подходит / более 5 лет).
- Токены цветов — CSS-переменные в styles/tokens.css; тема Element Plus переопределяется
  через них. Никаких градиентов, декоративных теней и анимаций появления секций.
- Навигация по клавиатуре и видимый фокус не ломать.

## 9. Проверка (Definition of Done)

Задача считается выполненной, только если:
1. `cd frontend && npm run type-check` — без ошибок.
2. `npm run build` — сборка проходит.
3. В консоли браузера нет ошибок и предупреждений Vue на затронутых экранах.
4. В конце ответа ты даёшь **чек-лист ручной проверки**: какие страницы открыть, что
   нажать, что должно получиться (включая проверку ошибок и 1366×768).
5. Если добавлена чистая логика (utils, sim) — к ней есть тест Vitest, `npx vitest run`
   проходит.

## 10. Как со мной работать

- Сначала кратко напиши план (какие файлы создашь/изменишь), потом делай.
- Делай только то, что в задаче. Замеченные проблемы вне задачи — перечисли в конце.
- Не делай git commit и push — коммиты делаю я.
- Если требование неоднозначно — выбери простой вариант, явно назови допущение.
