<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { DataAnalysis, Loading } from '@element-plus/icons-vue'
import { useWizardStore } from '@/stores/wizard'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import WhatIfPanel from '@/components/wizard/WhatIfPanel.vue'
import WhatIfCompareTable from '@/components/wizard/WhatIfCompareTable.vue'
import SensitivityChart from '@/components/charts/SensitivityChart.vue'
import { formatYears } from '@/utils/format'
import { strongestParam, whatIfBase, type WhatIfValues } from '@/utils/whatif'

const wizard = useWizardStore()

const hasScenarios = computed(() => ['purchase', 'raas'].every((k) => wizard.scenarios.some((s) => s.kind === k && s.robotId)))
const purchase = computed(() => wizard.scenarios.find((s) => s.kind === 'purchase') ?? null)
const purchaseRobot = computed(() => {
  const id = purchase.value?.robotId
  return id ? (wizard.robotById.get(id) ?? null) : null
})

// Исходные значения панели учитывают ручные правки, сделанные на шаге «Экономика».
const base = computed<WhatIfValues>(() =>
  whatIfBase(wizard.params, wizard.assumptions, purchaseRobot.value, purchase.value?.overrides),
)
const values = ref<WhatIfValues>({ ...(wizard.whatIfValues ?? base.value) })

// Параметры объекта могли измениться на прошлых шагах — панель начинается с новых исходных.
watch(base, (next) => {
  if (!wizard.whatIfValues) values.value = { ...next }
})

const result = computed(() => wizard.whatIfResult)
const scenarioOptions = computed(() => (result.value?.scenarios ?? []).filter((s) => s.kind !== 'baseline'))
const activeScenario = ref('purchase')
const series = computed(() => (result.value?.sensitivity ?? []).filter((s) => s.scenarioId === activeScenario.value))
const strongest = computed(() => strongestParam(series.value))
const currentPayback = computed(
  () => scenarioOptions.value.find((s) => s.id === activeScenario.value)?.metrics.paybackYears.value ?? null,
)

watch(scenarioOptions, (list) => {
  if (list.length && !list.some((s) => s.id === activeScenario.value)) activeScenario.value = list[0]!.id
})

onMounted(() => {
  if (hasScenarios.value && !wizard.whatIfResult && !wizard.whatIfLoading) void wizard.runWhatIf(values.value, base.value)
})

function setValue(key: keyof WhatIfValues, value: number) {
  values.value = { ...values.value, [key]: value }
}

function calculate() {
  void wizard.runWhatIf(values.value, base.value)
}

function resetAll() {
  values.value = { ...base.value }
}
</script>

<template>
  <div class="step-whatif">
    <EmptyState
      v-if="!hasScenarios"
      title="Не выбраны роботы для сценариев"
      description="Анализ «что если» строится по сценариям покупки и аренды. Выберите роботов на шаге «Сравнение»."
      :icon="DataAnalysis"
    >
      <el-button type="primary" @click="wizard.goTo(3)">Перейти к сравнению</el-button>
    </EmptyState>

    <template v-else>
      <p class="step-whatif__intro">
        Меняйте допущения и смотрите, как меняется экономика. Расчёт здесь ничего не меняет
        ни в проекте, ни на шаге «Экономика» и не попадает в историю расчётов.
      </p>

      <WhatIfPanel
        :values="values"
        :base="base"
        :busy="wizard.whatIfLoading"
        :perf-from-catalog="purchaseRobot?.specs.perfOpsPerHour != null || purchase?.overrides?.perfOpsPerHour != null"
        @update="setValue"
        @calculate="calculate"
        @reset-all="resetAll"
      />

      <ErrorAlert v-if="wizard.whatIfError" :error="wizard.whatIfError" retry @retry="calculate" />

      <el-skeleton v-if="!result && wizard.whatIfLoading" :rows="8" animated aria-busy="true" aria-label="Считаем варианты" />

      <template v-else-if="result">
        <p v-if="wizard.whatIfLoading" class="step-whatif__busy" role="status">
          <el-icon class="is-loading" aria-hidden="true"><Loading /></el-icon> Пересчитываем…
        </p>

        <section class="step-whatif__section" aria-labelledby="whatif-table-title">
          <h3 id="whatif-table-title" class="step-whatif__title">Сравнение сценариев</h3>
          <WhatIfCompareTable
            :scenarios="result.scenarios"
            :previous="wizard.whatIfPrevious?.scenarios ?? null"
          />
        </section>

        <section class="step-whatif__section" aria-labelledby="whatif-sens-title">
          <div class="step-whatif__bar">
            <h3 id="whatif-sens-title" class="step-whatif__title">Чувствительность окупаемости</h3>
            <el-radio-group v-model="activeScenario" size="small" aria-label="Сценарий для анализа чувствительности">
              <el-radio-button v-for="s in scenarioOptions" :key="s.id" :value="s.id">{{ s.title }}</el-radio-button>
            </el-radio-group>
          </div>

          <template v-if="series.length">
            <p v-if="strongest" class="step-whatif__strongest">
              Сильнее всего на окупаемость влияет <strong>{{ strongest.label.toLowerCase() }}</strong>:
              при отклонении от −20 % до +20 % срок окупаемости меняется на
              {{ formatYears(strongest.spreadYears) }}.
            </p>
            <SensitivityChart :series="series" :current-payback-years="currentPayback" />
          </template>
          <p v-else class="step-whatif__hint">
            Для этого сценария чувствительность не рассчитана: окупаемости нет ни при одном отклонении.
          </p>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.step-whatif {
  display: grid;
  gap: var(--space-4);
}

.step-whatif__section {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.step-whatif__intro,
.step-whatif__hint {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.step-whatif__busy {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
}

.step-whatif__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.step-whatif__title {
  font-size: 16px;
  font-weight: 600;
}

.step-whatif__strongest {
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-accent);
  border-radius: var(--radius);
}
</style>
