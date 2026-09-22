// Контракт API v1 (CLAUDE.md, раздел 5). Единственный источник типов API во фронтенде.
// Изменение этого файла = изменение контракта с бэкендом.

// ---------- Ошибки (формат ProblemDetails) ----------
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CALCULATION_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
export interface FieldError {
  field: string
  message: string
  hint?: string
}
export interface ApiError {
  status: number
  code: ErrorCode
  title: string
  errors?: FieldError[]
}
// NETWORK_ERROR (status 0) формирует сам фронтенд, если сервер недоступен.

// ---------- Авторизация ----------
export type Role = 'user' | 'admin'
export interface User {
  id: string
  email: string
  name: string
  role: Role
}
export interface LoginRequest {
  email: string
  password: string
}
export interface RegisterRequest {
  email: string
  password: string
  name: string
}
export interface AuthResponse {
  token: string
  user: User
}
// POST /auth/login     LoginRequest    → AuthResponse   (401 INVALID_CREDENTIALS)
// POST /auth/register  RegisterRequest → AuthResponse   (409 CONFLICT, 400 VALIDATION_ERROR)

// ---------- Типы объектов ----------
export type ParamValue = number | string | boolean | null
export type Params = Record<string, ParamValue>
export interface ParamField {
  key: string
  label: string
  group: string
  type: 'number' | 'integer' | 'enum' | 'boolean' | 'string'
  unit?: string
  required: boolean
  min?: number
  max?: number
  options?: { value: string; label: string }[]
  default?: ParamValue
  example?: ParamValue
  hint?: string
  defaultSource?: { source: string; confirmed: boolean }
}
export interface Zone {
  id: string
  type: 'receiving' | 'storage' | 'picking' | 'shipping' | 'charging' | 'other'
  label: string
  rect: [number, number, number, number] // x, y, ширина, высота, м
  slots?: number
}
export interface Layout {
  widthM: number
  heightM: number
  zones: Zone[]
}
export interface ObjectType {
  code: string // 'warehouse' | 'airport' | 'hospital' | ...
  name: string
  description: string
  processes: { code: string; name: string }[]
  groups: { key: string; label: string }[]
  fields: ParamField[]
  demoParams: Params
  layout: Layout | null // null — симуляция для типа пока недоступна
}
// GET /object-types → ObjectType[]

// ---------- Каталог роботов ----------
export interface RobotSpecs {
  payloadKg?: number | null
  speedMps?: number | null
  perfOpsPerHour?: number | null
  autonomyH?: number | null
  chargeTimeH?: number | null
  positioningMm?: number | null
  navigation?: string | null
  minAisleM?: number | null
  widthM?: number | null
  lengthM?: number | null
  heightM?: number | null
  lifeYears?: number | null
}
export interface Robot {
  id: string
  name: string
  manufacturer: string
  solutionType: string
  solutionTypeName: string // 'amr' / 'AMR — автономный мобильный робот'
  objectTypes: string[]
  country: string | null
  availability: string | null
  price: number
  raasMonthlyPrice: number | null
  maintenancePerYear: number
  specs: RobotSpecs
  sourceUrl: string | null
  sourceDate: string | null
  confirmed: boolean
}
export type RobotInput = Omit<Robot, 'id'>
/** Параметры запроса GET /robots; пустые значения не передаются. */
export interface RobotListQuery {
  objectType?: string
  solutionType?: string
  q?: string
  sort?: string
}
// GET    /robots?objectType=&solutionType=&q=&sort=  → Robot[]
// GET    /robots/{id}                               → Robot
// POST   /robots        RobotInput → Robot   (admin)
// PUT    /robots/{id}   RobotInput → Robot   (admin)
// DELETE /robots/{id}                → 204   (admin)

// ---------- Проекты ----------
export interface Assumptions {
  horizonYears: number
  workDaysPerYear: number
  shiftsPerDay: number
  hoursPerShift: number
  utilization: number
  availability: number
  reserveShare: number
  staffReplacedShare: number
}
export interface ProjectInput {
  name: string
  objectType: string
  params: Params
  assumptions: Assumptions
}
export interface Project extends ProjectInput {
  id: string
  createdAt: string
  updatedAt: string
}
export interface ProjectSummary {
  id: string
  name: string
  objectType: string
  updatedAt: string
  lastPaybackYears: number | null
}
// GET    /projects                 → ProjectSummary[]
// POST   /projects   ProjectInput  → Project
// GET    /projects/{id}            → Project
// PUT    /projects/{id} ProjectInput → Project
// DELETE /projects/{id}            → 204
// POST   /projects/{id}/copy       → Project

// ---------- Расчёт ----------
export type ScenarioKind = 'baseline' | 'purchase' | 'raas'
export interface ScenarioInput {
  id: string
  kind: ScenarioKind
  title: string
  robotId: string | null // null только для baseline
  overrides?: { robotCount?: number | null; unitPriceRub?: number | null } // ручные правки
  raas?: { monthlyFeePerRobotRub: number; contractYears: number; setupRub: number }
}
export type SensParam = 'equipmentPrice' | 'operationsVolume' | 'laborCost'
export interface SimKpi {
  engineVersion: string
  seed: number
  throughputPerHour: number
  targetPerHour: number
  achievedPercent: number
  avgUtilization: number
  idleShare: number
  chargingShare: number
  maxQueue: number
  bottleneck: string
  confirmsCalculation: boolean
}
export interface CalcRequest {
  projectId: string | null // null или без токена — расчёт гостя, не сохраняется
  objectType: string
  processes: string[]
  params: Params
  assumptions: Assumptions
  scenarios: ScenarioInput[] // может быть пустым: тогда считаются подбор и baseline
  sensitivity: { params: SensParam[]; deltas: number[] } // deltas, напр. [-0.2,-0.1,0.1,0.2]
  simulation?: SimKpi | null
}

export type CheckResult = 'pass' | 'fail' | 'unknown'
export type RecStatus = 'recommended' | 'excluded' | 'needs_check'
export interface Check {
  rule: string
  label: string
  critical: boolean
  result: CheckResult
  required?: number | string | null
  actual?: number | string | null
  unit?: string | null
  message: string // готовая фраза на русском
}
export interface ScoreFactor {
  factor: string
  label: string
  weight: number
  value: number
  contribution: number
}
export interface RecommendationItem {
  robotId: string
  name: string
  solutionType: string
  status: RecStatus
  score: number | null
  checks: Check[]
  scoreBreakdown: ScoreFactor[]
  missingData: string[]
}
// Статус: есть критическая fail → excluded; иначе есть критическая unknown → needs_check;
// иначе recommended.

export type MetricKey =
  | 'robotCount'
  | 'capexRub'
  | 'opexAnnualRub'
  | 'opexDeltaRub'
  | 'annualEffectRub'
  | 'paybackYears'
  | 'roiPercent'
  | 'tcoRub'
export interface Metric {
  label: string
  value: number | null
  unit: string
  formula: string // человекочитаемая формула
  breakdown?: { key: string; label: string; value: number; source?: string }[]
  inputs?: Record<string, number>
  overridden: boolean // true — значение изменено вручную
}
export interface EquipmentLine {
  item: string
  qty: number
  unitPriceRub: number
  totalRub: number
}
export interface CashflowYear {
  year: number
  capexRub: number
  opexRub: number
  effectRub: number
  cumulativeRub: number
}
export interface Verdict {
  level: 'good' | 'moderate' | 'poor' | 'negative' // до 3 лет / 3–5 / более 5 / не окупается
  label: string
  interpretation: string
  risks: string[]
}
export interface ScenarioResult {
  id: string
  kind: ScenarioKind
  title: string
  robotId: string | null
  equipment: EquipmentLine[]
  metrics: Record<MetricKey, Metric>
  cashflow: CashflowYear[]
  verdict: Verdict
}
export interface SensitivityPoint {
  delta: number
  paybackYears: number | null
  roiPercent: number | null
  annualEffectRub: number
}
export interface SensitivitySeries {
  scenarioId: string
  param: SensParam
  label: string
  points: SensitivityPoint[]
}
export interface AssumptionRef {
  key: string
  label: string
  value: number | string
  unit: string
  source: string
  confirmed: boolean
}
export interface CalcResult {
  calculationId: string | null // null для гостя
  modelVersion: string
  dataVersion: string
  calculatedAt: string
  disclaimer: string // «Предварительная оценка…»
  recommendation: RecommendationItem[]
  scenarios: ScenarioResult[]
  sensitivity: SensitivitySeries[]
  assumptionsUsed: AssumptionRef[]
}
export interface CalculationSummary {
  id: string
  createdAt: string
  modelVersion: string
  dataVersion: string
  bestPaybackYears: number | null
}
export interface CalculationRecord {
  id: string
  createdAt: string
  request: CalcRequest
  result: CalcResult
}
// POST /calculations  CalcRequest → CalcResult            (гость или пользователь)
// GET  /projects/{id}/calculations → CalculationSummary[] (владелец)
// GET  /calculations/{id}          → CalculationRecord    (владелец)
// GET  /calculations/{id}/report.pdf   → файл PDF
// GET  /calculations/{id}/export.xlsx  → файл Excel
