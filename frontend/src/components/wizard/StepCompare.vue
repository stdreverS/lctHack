<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Finished } from '@element-plus/icons-vue'
import type { Robot } from '@/types/api'
import { useWizardStore } from '@/stores/wizard'
import CompareTable from '@/components/common/CompareTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import ScenarioRobotPicker, { type PickerOption } from '@/components/wizard/ScenarioRobotPicker.vue'
import { buildComparison } from '@/utils/robotSpecs'
import { SCENARIO_TITLES, scenarioRobotId } from '@/utils/recommendation'

const COMPARE_GROUPS = ['technical', 'infrastructure', 'economics', 'quality']

const wizard = useWizardStore()

const loading = ref(false)
const error = ref<unknown>(null)
const onlyDiffs = ref(false)
const attempted = ref(false)
const pickersRef = ref<HTMLElement>()

async function load() {
  loading.value = true
  error.value = null
  try {
    await wizard.loadRobots()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!wizard.robots.length) void load()
})

const robots = computed(() =>
  wizard.selectedRobotIds.map((id) => wizard.robotById.get(id)).filter((r): r is Robot => r !== undefined),
)
const ctx = computed(() => ({ objectTypeNames: Object.fromEntries(wizard.objectTypes.map((t) => [t.code, t.name])) }))
const allGroups = computed(() => buildComparison(robots.value, ctx.value, COMPARE_GROUPS))
const diffCount = computed(() => allGroups.value.reduce((n, g) => n + g.rows.filter((r) => r.differs).length, 0))
const groups = computed(() =>
  allGroups.value
    .map((g) => ({ ...g, rows: onlyDiffs.value ? g.rows.filter((r) => r.differs) : g.rows }))
    .filter((g) => g.rows.length > 0),
)

function options(kind: 'purchase' | 'raas'): PickerOption[] {
  return robots.value.map((robot) => ({
    robot,
    manual: wizard.manualRobotIds.includes(robot.id),
    disabledReason:
      kind === 'raas' && robot.raasMonthlyPrice == null
        ? 'RaaS недоступен: поставщик не указал цену аренды'
        : '',
  }))
}

const purchaseOptions = computed(() => options('purchase'))
const raasOptions = computed(() => options('raas'))
const noRaas = computed(() => raasOptions.value.every((o) => o.disabledReason))

const purchaseId = computed({
  get: () => scenarioRobotId(wizard.scenarios, 'purchase'),
  set: (id: string | null) => wizard.setScenarioRobot('purchase', id),
})
const raasId = computed({
  get: () => scenarioRobotId(wizard.scenarios, 'raas'),
  set: (id: string | null) => wizard.setScenarioRobot('raas', id),
})

const purchaseError = computed(() =>
  attempted.value && !purchaseId.value ? 'Выберите робота для сценария «Покупка».' : '',
)
const raasError = computed(() => {
  if (!attempted.value || raasId.value) return ''
  return noRaas.value
    ? 'Ни у одного выбранного робота нет цены аренды. Вернитесь к подбору и добавьте робота с ценой RaaS.'
    : 'Выберите робота для сценария «Роботы как услуга».'
})

async function validate(): Promise<boolean> {
  if (!robots.value.length) {
    ElMessage.warning('Сначала выберите роботов для сравнения на шаге «Подбор»')
    return false
  }
  attempted.value = true
  if (purchaseId.value && raasId.value) return true
  await nextTick()
  pickersRef.value?.scrollIntoView({ block: 'nearest' })
  pickersRef.value?.querySelector<HTMLElement>('input:not([disabled])')?.focus({ preventScroll: true })
  return false
}

defineExpose({ validate })
</script>

<template>
  <div class="step-compare">
    <EmptyState
      v-if="!wizard.selectedRobotIds.length"
      title="Роботы для сравнения не выбраны"
      description="Отметьте «Сравнить» у одного–трёх роботов на шаге «Подбор»."
      :icon="Finished"
    >
      <el-button type="primary" @click="wizard.goTo(2)">Перейти к подбору</el-button>
    </EmptyState>

    <el-skeleton v-else-if="loading" :rows="6" animated aria-busy="true" aria-label="Загрузка характеристик роботов" />

    <ErrorAlert v-else-if="error" :error="error" retry @retry="load" />

    <template v-else>
      <section class="step-compare__section" aria-labelledby="compare-table-title">
        <div class="step-compare__toolbar">
          <h3 id="compare-table-title" class="step-compare__title">Характеристики</h3>
          <span class="step-compare__hint">
            <span class="step-compare__swatch" aria-hidden="true"></span>
            Выделены строки, где значения отличаются ({{ diffCount }})
          </span>
          <el-switch v-model="onlyDiffs" active-text="Только различия" :disabled="robots.length < 2" />
        </div>
        <CompareTable :robots="robots" :groups="groups">
          <template #robot="{ robot }">
            {{ robot.name }}
            <span v-if="wizard.manualRobotIds.includes(robot.id)" class="step-compare__manual">добавлен вручную</span>
          </template>
        </CompareTable>
        <p v-if="!groups.length" class="step-compare__hint">Все характеристики выбранных роботов совпадают.</p>
      </section>

      <section ref="pickersRef" class="step-compare__section" aria-labelledby="compare-scenarios-title">
        <h3 id="compare-scenarios-title" class="step-compare__title">Роботы для сценариев экономики</h3>
        <p class="step-compare__hint">
          Сценарий «{{ SCENARIO_TITLES.baseline }}» считается всегда. Для покупки и аренды можно выбрать одного и того же робота.
        </p>
        <div class="step-compare__pickers">
          <ScenarioRobotPicker
            v-model="purchaseId"
            kind="purchase"
            :title="SCENARIO_TITLES.purchase"
            description="Роботы покупаются в собственность: разовые вложения и расходы на обслуживание."
            :options="purchaseOptions"
            :error="purchaseError"
          />
          <ScenarioRobotPicker
            v-model="raasId"
            kind="raas"
            :title="SCENARIO_TITLES.raas"
            description="Роботы арендуются у поставщика с ежемесячной платой, обслуживание включено."
            :options="raasOptions"
            :error="raasError"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.step-compare {
  display: grid;
  gap: var(--space-5);
}

.step-compare__section {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.step-compare__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
}

.step-compare__title {
  font-size: 16px;
  font-weight: 600;
}

.step-compare__toolbar .step-compare__title {
  margin-right: auto;
}

.step-compare__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.step-compare__swatch {
  width: 14px;
  height: 14px;
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--color-primary);
}

.step-compare__manual {
  display: inline-block;
  margin-left: var(--space-1);
  padding: 0 var(--space-1);
  font-size: 11px;
  font-weight: 400;
  border: 1px dashed var(--color-danger);
  border-radius: 2px;
}

.step-compare__pickers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}
</style>
