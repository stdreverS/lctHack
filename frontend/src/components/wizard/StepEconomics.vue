<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DataLine, Loading } from '@element-plus/icons-vue'
import type { ScenarioInput } from '@/types/api'
import { useWizardStore } from '@/stores/wizard'
import { useAuthStore } from '@/stores/auth'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import CashflowChart from '@/components/charts/CashflowChart.vue'
import EconScenarioSummary from '@/components/wizard/EconScenarioSummary.vue'
import EconScenarioDetails from '@/components/wizard/EconScenarioDetails.vue'
import EconRaasTerms from '@/components/wizard/EconRaasTerms.vue'
import EconAssumptions from '@/components/wizard/EconAssumptions.vue'
import EconOverrideDialog from '@/components/wizard/EconOverrideDialog.vue'
import EconKeyFigure from '@/components/wizard/EconKeyFigure.vue'
import { bestScenario } from '@/utils/economics'
import { isApiError } from '@/utils/errors'

type RobotKind = 'purchase' | 'raas'
type Field = 'robotCount' | 'unitPriceRub'

const wizard = useWizardStore()
const auth = useAuthStore()

const hasScenarios = computed(() => ['purchase', 'raas'].every((k) => wizard.scenarios.some((s) => s.kind === k && s.robotId)))
const result = computed(() => wizard.result)
const best = computed(() => (result.value ? bestScenario(result.value.scenarios) : null))
const activeTab = ref('purchase')
const calcFailed = computed(() => isApiError(wizard.economicsError) && wizard.economicsError.code === 'CALCULATION_ERROR')

onMounted(() => {
  if (hasScenarios.value && (!wizard.result || wizard.economicsStale) && !wizard.economicsLoading) void wizard.runEconomics()
})

function inputOf(kind: RobotKind): ScenarioInput | undefined {
  return wizard.scenarios.find((s) => s.kind === kind)
}

function robotName(robotId: string | null): string | null {
  return robotId ? (wizard.robotById.get(robotId)?.name ?? null) : null
}

// ---------- Ручные корректировки ----------
const editing = ref<{ kind: RobotKind; field: Field } | null>(null)
const dialogOpen = ref(false)

const dialog = computed(() => {
  const e = editing.value
  if (!e) return null
  const input = inputOf(e.kind)
  const res = result.value?.scenarios.find((s) => s.kind === e.kind)
  const robot = input?.robotId ? wizard.robotById.get(input.robotId) : undefined
  if (e.field === 'robotCount') {
    return {
      title: `Число роботов — ${input?.title ?? ''}`,
      label: 'Количество роботов', unit: 'шт.', min: 1, max: 500, integer: true,
      hint: 'Расчётное значение зависит от пиковой нагрузки и производительности робота. Ручное значение будет отмечено в расчёте.',
      current: input?.overrides?.robotCount ?? res?.metrics.robotCount.value ?? null,
      overridden: input?.overrides?.robotCount != null,
    }
  }
  return {
    title: `Цена робота — ${input?.title ?? ''}`,
    label: 'Цена одного робота', unit: '₽', min: 1, max: 1_000_000_000, integer: false,
    hint: 'Например, цена из коммерческого предложения поставщика. По умолчанию — цена из каталога.',
    current: input?.overrides?.unitPriceRub ?? res?.equipment[0]?.unitPriceRub ?? robot?.price ?? null,
    overridden: input?.overrides?.unitPriceRub != null,
  }
})

function edit(kind: RobotKind, field: Field) {
  editing.value = { kind, field }
  dialogOpen.value = true
}

function applyOverride(value: number | null) {
  if (!editing.value) return
  wizard.setOverride(editing.value.kind, editing.value.field, value)
  void wizard.runEconomics()
}

function changeTerms(terms: NonNullable<ScenarioInput['raas']>) {
  wizard.setRaasTerms(terms)
  void wizard.runEconomics()
}
</script>

<template>
  <div class="step-econ">
    <EmptyState
      v-if="!hasScenarios"
      title="Не выбраны роботы для сценариев"
      description="Выберите робота для покупки и для аренды (RaaS) на шаге «Сравнение»."
      :icon="DataLine"
    >
      <el-button type="primary" @click="wizard.goTo(3)">Перейти к сравнению</el-button>
    </EmptyState>

    <el-skeleton v-else-if="!result && wizard.economicsLoading" :rows="8" animated aria-busy="true" aria-label="Считаем экономику" />

    <div v-else-if="!result" class="step-econ__error">
      <ErrorAlert :error="wizard.economicsError" retry @retry="wizard.runEconomics()" />
      <div v-if="calcFailed" class="step-econ__fix">
        <span>Задайте число роботов вручную:</span>
        <el-button @click="edit('purchase', 'robotCount')">Покупка</el-button>
        <el-button @click="edit('raas', 'robotCount')">Роботы как услуга</el-button>
      </div>
    </div>

    <template v-else>
      <el-alert v-if="wizard.mode === 'guest'" type="info" :closable="false" show-icon class="step-econ__guest">
        <template #title>
          <template v-if="auth.isLoggedIn">
            Гостевой расчёт не сохраняется.
            <RouterLink :to="{ name: 'projects' }">Создайте проект</RouterLink>, чтобы сохранить расчёт и историю.
          </template>
          <template v-else>
            <RouterLink :to="{ name: 'login', query: { redirect: '/demo' } }">Войдите</RouterLink>, чтобы сохранить
            расчёт. Без входа результаты пропадут после перезагрузки страницы.
          </template>
        </template>
      </el-alert>
      <p v-else-if="wizard.calculationSaved" class="step-econ__saved">Расчёт сохранён в истории проекта.</p>
      <p v-else class="step-econ__saved">Чтобы сохранить расчёт в истории проекта, перейдите к шагу «Экспорт».</p>

      <p v-if="wizard.economicsLoading" class="step-econ__busy" role="status">
        <el-icon class="is-loading" aria-hidden="true"><Loading /></el-icon> Пересчитываем…
      </p>
      <ErrorAlert v-if="wizard.economicsError" :error="wizard.economicsError" retry @retry="wizard.runEconomics()" />

      <EconKeyFigure :best="best" :aria-busy="wizard.economicsLoading" />

      <div class="step-econ__columns">
        <EconScenarioSummary
          v-for="s in result.scenarios"
          :key="s.id"
          :scenario="s"
          :robot-name="robotName(s.robotId)"
          :best="best?.id === s.id"
        />
      </div>

      <section class="step-econ__section" aria-labelledby="econ-details-title">
        <h3 id="econ-details-title" class="step-econ__title">Подробно по сценариям</h3>
        <p class="step-econ__hint">Нажмите на показатель, чтобы увидеть формулу, исходные данные и источники.</p>
        <el-tabs v-model="activeTab">
          <el-tab-pane v-for="s in result.scenarios" :key="s.id" :label="s.title" :name="s.kind" lazy>
            <EconRaasTerms
              v-if="s.kind === 'raas' && inputOf('raas')?.raas"
              class="step-econ__terms"
              :terms="inputOf('raas')!.raas!"
              :catalog-fee="wizard.robotById.get(s.robotId ?? '')?.raasMonthlyPrice ?? null"
              :disabled="wizard.economicsLoading"
              @change="changeTerms"
            />
            <EconScenarioDetails
              :scenario="s"
              :assumptions="result.assumptionsUsed"
              :price-overridden="s.kind === 'purchase' && inputOf('purchase')?.overrides?.unitPriceRub != null"
              @edit="(field) => s.kind !== 'baseline' && edit(s.kind, field)"
            />
          </el-tab-pane>
        </el-tabs>
      </section>

      <section class="step-econ__section" aria-labelledby="econ-cashflow-title">
        <h3 id="econ-cashflow-title" class="step-econ__title">Накопленный денежный поток</h3>
        <CashflowChart :scenarios="result.scenarios" />
      </section>

      <EconAssumptions
        :assumptions="result.assumptionsUsed"
        :disclaimer="result.disclaimer"
        :model-version="result.modelVersion"
        :data-version="result.dataVersion"
      />
    </template>

    <EconOverrideDialog v-if="dialog" v-model="dialogOpen" v-bind="dialog" @apply="applyOverride" />
  </div>
</template>

<style scoped>
.step-econ {
  display: grid;
  gap: var(--space-4);
}

.step-econ__error,
.step-econ__section {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.step-econ__fix {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.step-econ__fix .el-button + .el-button {
  margin-left: 0;
}

.step-econ__guest :deep(a),
.step-econ__guest :deep(.el-alert__title) {
  color: var(--color-text);
}

.step-econ__saved,
.step-econ__hint {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.step-econ__busy {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
}

.step-econ__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-3);
}

.step-econ__title {
  font-size: 16px;
  font-weight: 600;
}

.step-econ__terms {
  margin-bottom: var(--space-4);
}
</style>
