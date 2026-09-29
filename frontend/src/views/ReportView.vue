<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Document, FolderChecked } from '@element-plus/icons-vue'
import type { CalcResult } from '@/types/api'
import { calculate } from '@/api/calculations'
import { useWizardStore } from '@/stores/wizard'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import ReportDocument from '@/components/report/ReportDocument.vue'
import { reportRequest } from '@/utils/report'
import { buildSimInput } from '@/utils/simInput'
import { runSimulation } from '@/sim/engine'

// Печатная версия отчёта (п. 3.7.2 ТЗ): /demo/report для гостя, /app/projects/:id/report для проекта.
// Отчёт строится по текущему состоянию мастера; PDF сохраняет браузер через печать.
const route = useRoute()
const wizard = useWizardStore()

const projectId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null))
const backTo = computed(() => (projectId.value ? { name: 'project', params: { id: projectId.value } } : { name: 'demo' }))

const loading = ref(true)
const error = ref<unknown>(null)
const result = ref<CalcResult | null>(null)

const ready = computed(
  () => Boolean(wizard.objectType) && ['purchase', 'raas'].every((k) => wizard.scenarios.some((s) => s.kind === k && s.robotId)),
)

async function load() {
  loading.value = true
  error.value = null
  result.value = null
  try {
    if (projectId.value) {
      const loaded = wizard.mode === 'project' && wizard.projectId === projectId.value && !wizard.projectError
      if (!loaded) await wizard.openProject(projectId.value)
      if (wizard.projectError) throw wizard.projectError
    } else {
      wizard.startGuest()
    }
    await Promise.all([wizard.loadObjectTypes(), wizard.loadRobots()])
    if (!ready.value || !wizard.objectType) return
    result.value = await calculate(
      reportRequest({
        objectType: wizard.objectType,
        processes: wizard.processes,
        params: wizard.params,
        assumptions: wizard.assumptions,
        scenarios: wizard.scenarios,
        simulation: wizard.simKpiActual,
      }),
    )
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

/**
 * KPI симуляции для отчёта: прогон из мастера, если он актуален; иначе модель прогоняется
 * здесь же по сценарию отчёта (прогон детерминирован и занимает миллисекунды).
 */
const sim = computed(() => {
  const res = result.value
  const layout = wizard.currentType?.layout
  if (!res || !layout) return null
  const scenario = res.scenarios.find((s) => s.kind === wizard.simKind) ?? res.scenarios.find((s) => s.kind === 'purchase')
  if (!scenario) return null
  if (wizard.simKpiActual) return { kpi: wizard.simKpiActual, title: scenario.title }
  const robot = scenario.robotId ? (wizard.robotById.get(scenario.robotId) ?? null) : null
  const { input } = buildSimInput({ layout, params: wizard.params, assumptions: wizard.assumptions, scenario, robot })
  return { kpi: runSimulation(input).kpi, title: scenario.title }
})

function print() {
  window.print()
}

onMounted(load)
</script>

<template>
  <section class="report-view">
    <div class="report-view__bar no-print">
      <el-button link :icon="ArrowLeft" @click="$router.push(backTo)">Вернуться к мастеру</el-button>
      <div class="report-view__print">
        <el-button type="primary" :icon="Document" :disabled="!result" @click="print">Скачать PDF</el-button>
        <p class="report-view__hint">
          PDF формируется из печатной версии: в окне печати выберите «Сохранить как PDF».
          Бумага A4, поля по умолчанию.
        </p>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="10" animated aria-busy="true" aria-label="Формируем отчёт" />

    <ErrorAlert v-else-if="error" :error="error" retry @retry="load" />

    <EmptyState
      v-else-if="!result"
      title="Отчёт пока не из чего собрать"
      description="Отчёт строится по трём сценариям. Пройдите мастер до шага «Сравнение» и выберите роботов для покупки и аренды."
      :icon="FolderChecked"
    >
      <el-button type="primary" @click="$router.push(backTo)">Перейти к мастеру</el-button>
    </EmptyState>

    <ReportDocument
      v-else-if="wizard.currentType"
      :result="result"
      :type="wizard.currentType"
      :params="wizard.params"
      :processes="wizard.processes"
      :robots="wizard.robots"
      :object-type-names="Object.fromEntries(wizard.objectTypes.map((t) => [t.code, t.name]))"
      :project-name="projectId ? wizard.projectName : null"
      :sim-kpi="sim?.kpi ?? null"
      :sim-scenario="sim?.title ?? null"
    />
  </section>
</template>

<style scoped>
.report-view {
  display: grid;
  gap: var(--space-4);
}

.report-view__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.report-view__print {
  display: grid;
  justify-items: end;
  gap: var(--space-1);
  max-width: 420px;
}

.report-view__hint {
  color: var(--color-text-secondary);
  font-size: 13px;
  text-align: right;
}
</style>
