import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { getObjectTypes } from '@/api/objectTypes'
import { getProject, updateProject } from '@/api/projects'
import { calculate } from '@/api/calculations'
import { getRobots } from '@/api/robots'
import type {
  Assumptions,
  CalcResult,
  CalculationRecord,
  ObjectType,
  Params,
  Project,
  ProjectInput,
  Robot,
  ScenarioInput,
} from '@/types/api'
import type { SimInput, SimResult } from '@/types/sim'
import { runSimulation as runEngine } from '@/sim/engine'
import { DEFAULT_ASSUMPTIONS, manualParams } from '@/utils/projects'
import { MAX_COMPARE, RAAS_DEFAULT_TERMS, patchScenario, withScenarioRobot } from '@/utils/recommendation'
import { SENS_DELTAS, SENS_PARAMS, applyWhatIf, type WhatIfValues } from '@/utils/whatif'
import { validateParams } from '@/utils/validateParams'

/** guest — /demo без сохранения; project — /app/projects/:id с сохранением. */
export type WizardMode = 'guest' | 'project'
/** Способ заполнения параметров, выбранный на шаге «Объект». */
export type FillMode = 'demo' | 'manual' | 'csv'

export const WIZARD_STEP_COUNT = 8

/** Объект с отсортированными ключами; null равен отсутствию ключа. */
function sorted(obj: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== null)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

/** Снимок проекта для отслеживания несохранённых изменений. */
function snapshot(input: ProjectInput): string {
  return JSON.stringify([input.name, input.objectType, sorted(input.params), sorted(input.assumptions)])
}

/** Снимок входных данных подбора: если он изменился — подбор устарел. */
function recommendKey(objectType: string | null, processes: string[], params: Params, assumptions: Assumptions): string {
  return JSON.stringify([objectType, [...processes].sort(), sorted(params), sorted(assumptions)])
}

function hasValues(params: Params): boolean {
  return Object.values(params).some((v) => v !== null && v !== '')
}

export const useWizardStore = defineStore('wizard', () => {
  // ---------- Состояние мастера ----------
  const mode = ref<WizardMode>('guest')
  const step = ref(0)
  const projectId = ref<string | null>(null)
  const projectName = ref('')
  const projectUpdatedAt = ref<string | null>(null)
  const objectType = ref<string | null>(null)
  const processes = ref<string[]>([])
  const fillMode = ref<FillMode | null>(null)
  const params = ref<Params>({})
  const assumptions = ref<Assumptions>({ ...DEFAULT_ASSUMPTIONS })
  const selectedRobotIds = ref<string[]>([])
  /** Роботы из группы «Не подходит», добавленные к сравнению вручную. */
  const manualRobotIds = ref<string[]>([])
  const scenarios = ref<ScenarioInput[]>([])
  /** Результат расчёта экономики (шаг 5). */
  const result = ref<CalcResult | null>(null)
  /** id расчёта, сохранённого в истории проекта кнопкой «Сохранить расчёт» (шаг «Экспорт»). */
  const calculationId = ref<string | null>(null)

  // ---------- Справочник типов объектов (кэш на сессию) ----------
  const objectTypes = ref<ObjectType[]>([])
  let objectTypesRequest: Promise<ObjectType[]> | null = null

  function loadObjectTypes(): Promise<ObjectType[]> {
    objectTypesRequest ??= getObjectTypes().then(
      (types) => (objectTypes.value = types),
      (error: unknown) => {
        objectTypesRequest = null // следующая попытка пойдёт на сервер
        throw error
      },
    )
    return objectTypesRequest
  }

  const currentType = computed(() => objectTypes.value.find((t) => t.code === objectType.value) ?? null)
  const paramIssues = computed(() => (currentType.value ? validateParams(currentType.value.fields, params.value) : []))

  // ---------- Каталог роботов (кэш на сессию) ----------
  const robots = ref<Robot[]>([])
  let robotsRequest: Promise<Robot[]> | null = null

  function loadRobots(): Promise<Robot[]> {
    robotsRequest ??= getRobots().then(
      (list) => (robots.value = list),
      (error: unknown) => {
        robotsRequest = null
        throw error
      },
    )
    return robotsRequest
  }

  const robotById = computed(() => new Map(robots.value.map((r) => [r.id, r])))

  /** Каталог изменён администратором — при следующем обращении список загрузится заново. */
  function invalidateRobots() {
    robotsRequest = null
  }

  // ---------- Подбор (шаг 3) ----------
  const recommendation = ref<CalcResult | null>(null)
  const recommendedFor = ref<string | null>(null)
  const recommendLoading = ref(false)
  const recommendError = ref<unknown>(null)
  let recommendSeq = 0

  const currentRecommendKey = computed(() =>
    recommendKey(objectType.value, processes.value, params.value, assumptions.value),
  )
  /** Параметры изменились после расчёта подбора. */
  const recommendStale = computed(
    () => recommendation.value !== null && recommendedFor.value !== currentRecommendKey.value,
  )

  /**
   * POST /calculations без сценариев — только подбор. Расчёт не привязывается к проекту
   * (projectId: null), чтобы в истории расчётов оставались только расчёты экономики.
   * Выбранные роботы, ставшие неподходящими, снимаются с выбора (кроме добавленных вручную).
   * Возвращает названия снятых роботов.
   */
  async function runRecommendation(): Promise<string[]> {
    if (!objectType.value) return []
    const seq = ++recommendSeq
    const key = currentRecommendKey.value
    recommendLoading.value = true
    recommendError.value = null
    try {
      const [res] = await Promise.all([
        calculate({
          projectId: null,
          objectType: objectType.value,
          processes: processes.value,
          params: params.value,
          assumptions: assumptions.value,
          scenarios: [],
          sensitivity: { params: [], deltas: [] },
          simulation: null,
        }),
        loadRobots(),
      ])
      if (seq !== recommendSeq) return []
      recommendation.value = res
      recommendedFor.value = key
      const byId = new Map(res.recommendation.map((i) => [i.robotId, i]))
      const dropped = selectedRobotIds.value.filter((id) => {
        const rec = byId.get(id)
        return !rec || (rec.status === 'excluded' && !manualRobotIds.value.includes(id))
      })
      dropped.forEach((id) => toggleRobot(id, false))
      manualRobotIds.value = manualRobotIds.value.filter((id) => byId.get(id)?.status === 'excluded')
      return dropped.map((id) => byId.get(id)?.name ?? robotById.value.get(id)?.name ?? id)
    } catch (error) {
      if (seq === recommendSeq) recommendError.value = error
      return []
    } finally {
      if (seq === recommendSeq) recommendLoading.value = false
    }
  }

  /** Добавляет робота к сравнению (manual — робот из «Не подходит», подтверждено пользователем). */
  function toggleRobot(robotId: string, selected: boolean, manual = false) {
    if (selected) {
      if (selectedRobotIds.value.includes(robotId) || selectedRobotIds.value.length >= MAX_COMPARE) return
      selectedRobotIds.value = [...selectedRobotIds.value, robotId]
      if (manual && !manualRobotIds.value.includes(robotId)) manualRobotIds.value = [...manualRobotIds.value, robotId]
      return
    }
    selectedRobotIds.value = selectedRobotIds.value.filter((id) => id !== robotId)
    manualRobotIds.value = manualRobotIds.value.filter((id) => id !== robotId)
    for (const s of scenarios.value) {
      if (s.robotId === robotId && s.kind !== 'baseline') setScenarioRobot(s.kind, null)
    }
  }

  // ---------- Сценарии (шаг 4) ----------
  /** Для RaaS без условий подставляет условия по умолчанию (плата — из каталога). */
  function withRaasDefaults(list: ScenarioInput[]): ScenarioInput[] {
    const raas = list.find((s) => s.kind === 'raas')
    if (!raas || raas.raas || !raas.robotId) return list
    const fee = robotById.value.get(raas.robotId)?.raasMonthlyPrice
    if (fee == null) return list
    return patchScenario(list, 'raas', { raas: { monthlyFeePerRobotRub: fee, ...RAAS_DEFAULT_TERMS } })
  }

  function setScenarioRobot(kind: 'purchase' | 'raas', robotId: string | null) {
    scenarios.value = withRaasDefaults(withScenarioRobot(scenarios.value, kind, robotId))
  }

  // ---------- Экономика (шаг 5) ----------
  const economicsFor = ref<string | null>(null)
  const economicsLoading = ref(false)
  const economicsError = ref<unknown>(null)
  let economicsSeq = 0

  const currentEconomicsKey = computed(() => JSON.stringify([currentRecommendKey.value, scenarios.value]))
  /** Параметры или сценарии изменились после расчёта экономики. */
  const economicsStale = computed(() => result.value !== null && economicsFor.value !== currentEconomicsKey.value)

  /**
   * POST /calculations с тремя сценариями. Расчёт не привязывается к проекту (projectId: null):
   * в историю он попадает только по кнопке «Сохранить расчёт» на шаге «Экспорт» —
   * вместе с KPI симуляции, которой на этом шаге ещё нет.
   */
  async function runEconomics() {
    if (!objectType.value) return
    scenarios.value = withRaasDefaults(scenarios.value)
    const seq = ++economicsSeq
    const key = currentEconomicsKey.value
    economicsLoading.value = true
    economicsError.value = null
    try {
      const res = await calculate({
        projectId: null,
        objectType: objectType.value,
        processes: processes.value,
        params: params.value,
        assumptions: assumptions.value,
        scenarios: scenarios.value,
        sensitivity: { params: [], deltas: [] },
        simulation: null,
      })
      if (seq !== economicsSeq) return
      result.value = res
      economicsFor.value = key
    } catch (error) {
      if (seq === economicsSeq) economicsError.value = error
    } finally {
      if (seq === economicsSeq) economicsLoading.value = false
    }
  }

  // ---------- What-if (шаг 6) ----------
  /** Значения панели допущений последнего расчёта what-if. */
  const whatIfValues = ref<WhatIfValues | null>(null)
  const whatIfResult = ref<CalcResult | null>(null)
  /** Предыдущий расчёт what-if — для стрелок «стало лучше/хуже». */
  const whatIfPrevious = ref<CalcResult | null>(null)
  const whatIfLoading = ref(false)
  const whatIfError = ref<unknown>(null)
  let whatIfSeq = 0

  /**
   * Расчёт what-if: значения панели подставляются в параметры, допущения и сценарии.
   * Расчёт не привязан к проекту (projectId: null) — это подбор вариантов, а не итог,
   * и он не меняет данные проекта и результат шага «Экономика».
   */
  async function runWhatIf(values: WhatIfValues, base: WhatIfValues) {
    if (!objectType.value) return
    const seq = ++whatIfSeq
    whatIfLoading.value = true
    whatIfError.value = null
    try {
      const parts = applyWhatIf(
        { params: params.value, assumptions: assumptions.value, scenarios: scenarios.value },
        values,
        base,
      )
      const res = await calculate({
        projectId: null,
        objectType: objectType.value,
        processes: processes.value,
        ...parts,
        sensitivity: { params: SENS_PARAMS, deltas: SENS_DELTAS },
        simulation: null,
      })
      if (seq !== whatIfSeq) return
      whatIfPrevious.value = whatIfResult.value
      whatIfResult.value = res
      whatIfValues.value = { ...values }
    } catch (error) {
      if (seq === whatIfSeq) whatIfError.value = error
    } finally {
      if (seq === whatIfSeq) whatIfLoading.value = false
    }
  }

  /** Ручная корректировка сценария; null — вернуть расчётное значение. */
  function setOverride(kind: 'purchase' | 'raas', field: 'robotCount' | 'unitPriceRub', value: number | null) {
    const current = scenarios.value.find((s) => s.kind === kind)
    if (!current) return
    const overrides = { ...current.overrides, [field]: value }
    scenarios.value = patchScenario(scenarios.value, kind, { overrides })
  }

  function setRaasTerms(terms: NonNullable<ScenarioInput['raas']>) {
    scenarios.value = patchScenario(scenarios.value, 'raas', { raas: { ...terms } })
  }

  // ---------- Симуляция (шаг 7) ----------
  /** Сценарий, который проигрывается на плане объекта. */
  const simKind = ref<'purchase' | 'raas'>('purchase')
  /** Результат прогона; shallowRef — внутри тысячи отрезков, глубокая реактивность им не нужна. */
  const simResult = shallowRef<SimResult | null>(null)
  /** Вход, по которому получен результат: если он изменился, модель считается заново. */
  const simFor = ref<string | null>(null)
  /** Входные данные экономики на момент прогона: по ним видно, что симуляция устарела. */
  const simEconomicsFor = ref<string | null>(null)
  const simLoading = ref(false)
  const simError = ref<unknown>(null)
  let simSeq = 0

  /** KPI последнего прогона. */
  const simKpi = computed(() => simResult.value?.kpi ?? null)
  /** KPI прогона по текущим параметрам и сценариям: уходит полем simulation в сохраняемый расчёт. */
  const simKpiActual = computed(() => (simEconomicsFor.value === currentEconomicsKey.value ? simKpi.value : null))

  /**
   * Прогон модели. Движок считает синхронно: час работы полусотни роботов — десятки
   * миллисекунд, отдельный воркер не нужен. Перед расчётом отдаём браузеру кадр,
   * чтобы успел появиться статус «Идёт расчёт модели…».
   */
  async function runSim(input: SimInput) {
    const key = JSON.stringify(input)
    if (key === simFor.value && simResult.value) return
    const seq = ++simSeq
    simLoading.value = true
    simError.value = null
    try {
      await new Promise<void>((resolve) => {
        // Кадр даёт браузеру отрисовать статус; таймер — страховка для фоновой вкладки,
        // где requestAnimationFrame не вызывается.
        requestAnimationFrame(() => resolve())
        setTimeout(() => resolve(), 100)
      })
      if (seq !== simSeq) return
      const res = runEngine(input)
      if (seq !== simSeq) return
      simResult.value = res
      simFor.value = key
      simEconomicsFor.value = currentEconomicsKey.value
    } catch (error) {
      if (seq === simSeq) simError.value = error
    } finally {
      if (seq === simSeq) simLoading.value = false
    }
  }

  function setSimKind(kind: 'purchase' | 'raas') {
    simKind.value = kind
  }

  // ---------- Сохранение расчёта (шаг 8) ----------
  const calcSaving = ref(false)
  /** Входные данные сохранённого расчёта: если они изменились, сохранённый расчёт устарел. */
  const savedCalcFor = ref<string | null>(null)
  const currentSaveKey = computed(() => JSON.stringify([currentEconomicsKey.value, simKpiActual.value]))
  /** Сохранённый расчёт соответствует текущим параметрам — по нему можно формировать отчёты. */
  const calculationSaved = computed(() => calculationId.value !== null && savedCalcFor.value === currentSaveKey.value)

  /**
   * POST /calculations с projectId и KPI симуляции — расчёт попадает в историю проекта.
   * Несохранённые параметры проекта сначала сохраняются, чтобы проект и история совпадали.
   * Ошибку пробрасывает вызывающему — он показывает сообщение.
   */
  async function saveCalculation(): Promise<CalcResult | null> {
    if (mode.value !== 'project' || !projectId.value || !objectType.value) return null
    calcSaving.value = true
    try {
      if (hasUnsavedChanges.value) await save()
      scenarios.value = withRaasDefaults(scenarios.value)
      const economicsKey = currentEconomicsKey.value
      const saveKey = currentSaveKey.value
      const res = await calculate({
        projectId: projectId.value,
        objectType: objectType.value,
        processes: processes.value,
        params: params.value,
        assumptions: assumptions.value,
        scenarios: scenarios.value,
        sensitivity: { params: SENS_PARAMS, deltas: SENS_DELTAS },
        simulation: simKpiActual.value,
      })
      // Сохранённый результат заменяет показанный: входные данные те же.
      economicsSeq++
      economicsLoading.value = false
      economicsError.value = null
      result.value = res
      economicsFor.value = economicsKey
      calculationId.value = res.calculationId
      savedCalcFor.value = saveKey
      return res
    } finally {
      calcSaving.value = false
    }
  }

  // ---------- Проект: загрузка, сохранение, несохранённые изменения ----------
  const projectLoading = ref(false)
  const projectError = ref<unknown>(null)
  const saving = ref(false)
  const savedSnapshot = ref<string | null>(null)
  let loadSeq = 0

  function projectInput(): ProjectInput {
    return {
      name: projectName.value,
      objectType: objectType.value ?? '',
      params: params.value,
      assumptions: assumptions.value,
    }
  }

  const hasUnsavedChanges = computed(
    () => mode.value === 'project' && savedSnapshot.value !== null && snapshot(projectInput()) !== savedSnapshot.value,
  )

  function resetDownstream() {
    recommendSeq++
    recommendation.value = null
    recommendedFor.value = null
    recommendLoading.value = false
    recommendError.value = null
    selectedRobotIds.value = []
    manualRobotIds.value = []
    scenarios.value = []
    economicsSeq++
    result.value = null
    calculationId.value = null
    savedCalcFor.value = null
    economicsFor.value = null
    economicsLoading.value = false
    economicsError.value = null
    simSeq++
    simKind.value = 'purchase'
    simResult.value = null
    simFor.value = null
    simEconomicsFor.value = null
    simLoading.value = false
    simError.value = null
    whatIfSeq++
    whatIfValues.value = null
    whatIfResult.value = null
    whatIfPrevious.value = null
    whatIfLoading.value = false
    whatIfError.value = null
  }

  function reset(nextMode: WizardMode) {
    mode.value = nextMode
    step.value = 0
    projectId.value = null
    projectName.value = ''
    projectUpdatedAt.value = null
    objectType.value = null
    processes.value = []
    fillMode.value = null
    params.value = {}
    assumptions.value = { ...DEFAULT_ASSUMPTIONS }
    projectError.value = null
    savedSnapshot.value = null
    resetDownstream()
  }

  /** Гостевой режим. Если мастер уже в нём — прогресс сохраняется (до перезагрузки страницы). */
  function startGuest() {
    if (mode.value !== 'guest') reset('guest')
  }

  function applyProject(project: Project, types: ObjectType[]) {
    projectId.value = project.id
    projectName.value = project.name
    projectUpdatedAt.value = project.updatedAt
    objectType.value = project.objectType
    params.value = { ...project.params }
    assumptions.value = { ...project.assumptions }
    // Процессы в проекте не хранятся (их нет в ProjectInput) — по умолчанию выбраны все.
    processes.value = types.find((t) => t.code === project.objectType)?.processes.map((p) => p.code) ?? []
    fillMode.value = hasValues(project.params) ? 'manual' : null
    savedSnapshot.value = snapshot(projectInput())
  }

  async function openProject(id: string) {
    const seq = ++loadSeq
    reset('project')
    projectId.value = id
    projectLoading.value = true
    try {
      const [project, types] = await Promise.all([getProject(id), loadObjectTypes()])
      if (seq === loadSeq) applyProject(project, types)
    } catch (error) {
      if (seq === loadSeq) projectError.value = error
    } finally {
      if (seq === loadSeq) projectLoading.value = false
    }
  }

  /** PUT /projects/{id}. Ошибку пробрасывает вызывающему — он показывает сообщение. */
  async function save() {
    if (mode.value !== 'project' || !projectId.value) return
    const input = projectInput()
    const sent = snapshot(input)
    saving.value = true
    try {
      const project = await updateProject(projectId.value, input)
      projectUpdatedAt.value = project.updatedAt
      savedSnapshot.value = sent
    } finally {
      saving.value = false
    }
  }

  /**
   * Подставляет в мастер параметры сохранённого расчёта: объект, процессы, параметры,
   * допущения и сценарии. Результаты шагов сбрасываются и считаются заново.
   * Проект не сохраняется — это делает вызывающий.
   */
  function restoreCalculation(record: CalculationRecord) {
    const req = record.request
    resetDownstream()
    objectType.value = req.objectType
    processes.value = [...req.processes]
    params.value = { ...req.params }
    assumptions.value = { ...req.assumptions }
    fillMode.value = 'manual'
    scenarios.value = JSON.parse(JSON.stringify(req.scenarios)) as ScenarioInput[]
    const ids = req.scenarios.map((s) => s.robotId).filter((id): id is string => id !== null)
    selectedRobotIds.value = [...new Set(ids)].slice(0, MAX_COMPARE)
    // Со сценариями — сразу к экономике (она пересчитается), без них — к подбору.
    step.value = scenarios.value.length ? 4 : 2
  }

  // ---------- Шаг «Объект» ----------
  function selectObjectType(code: string) {
    if (code === objectType.value) return
    objectType.value = code
    processes.value = objectTypes.value.find((t) => t.code === code)?.processes.map((p) => p.code) ?? []
    params.value = {}
    fillMode.value = null
    resetDownstream()
  }

  function setProcesses(codes: string[]) {
    processes.value = codes
  }

  function chooseFillMode(next: FillMode) {
    const type = currentType.value
    if (!type) return
    fillMode.value = next
    params.value = next === 'demo' ? { ...type.demoParams } : manualParams(type, params.value)
  }

  // ---------- Шаг «Параметры» ----------
  function setParams(next: Params) {
    params.value = next
  }

  function mergeParams(patch: Params) {
    params.value = { ...params.value, ...patch }
  }

  function goTo(index: number) {
    step.value = Math.min(Math.max(index, 0), WIZARD_STEP_COUNT - 1)
  }

  return {
    mode, step, projectId, projectName, projectUpdatedAt, objectType, processes, fillMode, params,
    assumptions, selectedRobotIds, manualRobotIds, scenarios, result,
    objectTypes, currentType, paramIssues, loadObjectTypes,
    robots, robotById, loadRobots, invalidateRobots,
    recommendation, recommendLoading, recommendError, recommendStale, runRecommendation, toggleRobot,
    setScenarioRobot,
    calculationId, economicsLoading, economicsError, economicsStale, runEconomics, setOverride, setRaasTerms,
    whatIfValues, whatIfResult, whatIfPrevious, whatIfLoading, whatIfError, runWhatIf,
    simKind, simResult, simKpi, simKpiActual, simLoading, simError, runSim, setSimKind,
    calcSaving, calculationSaved, saveCalculation,
    projectLoading, projectError, saving, hasUnsavedChanges,
    startGuest, openProject, save, restoreCalculation,
    selectObjectType, setProcesses, chooseFillMode, setParams, mergeParams, goTo,
  }
})
