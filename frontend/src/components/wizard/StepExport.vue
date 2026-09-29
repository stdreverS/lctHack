<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled, FolderChecked, Loading } from '@element-plus/icons-vue'
import { useWizardStore } from '@/stores/wizard'
import { useAuthStore } from '@/stores/auth'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import ExportSummary from '@/components/wizard/ExportSummary.vue'
import ExportActions from '@/components/wizard/ExportActions.vue'
import { describeError } from '@/utils/errors'
import { usedRobots } from '@/utils/export'
import { formatDate } from '@/utils/format'

// Шаг 8: итоговая сводка, сохранение расчёта в историю проекта и выгрузки.
const wizard = useWizardStore()
const auth = useAuthStore()

const hasScenarios = computed(() =>
  ['purchase', 'raas'].every((kind) => wizard.scenarios.some((s) => s.kind === kind && s.robotId)),
)
const result = computed(() => wizard.result)
const objectName = computed(() => wizard.currentType?.name ?? wizard.objectType ?? '—')
const processNames = computed(() =>
  (wizard.currentType?.processes ?? []).filter((p) => wizard.processes.includes(p.code)).map((p) => p.name),
)
const robots = computed(() =>
  usedRobots(result.value?.scenarios ?? [], (id) => wizard.robotById.get(id)?.name ?? null),
)
const hasLayout = computed(() => Boolean(wizard.currentType?.layout))
/** KPI есть, но получены для прежних параметров — в сохраняемый расчёт не попадут. */
const simOutdated = computed(() => wizard.simKpi !== null && wizard.simKpiActual === null)
const canSave = computed(() => Boolean(result.value) && !wizard.economicsLoading && !wizard.economicsStale)

onMounted(() => {
  void wizard.loadRobots().catch(() => undefined) // названия роботов; без них покажем id
  if (hasScenarios.value && (!wizard.result || wizard.economicsStale) && !wizard.economicsLoading) {
    void wizard.runEconomics()
  }
})

async function saveCalculation() {
  try {
    await wizard.saveCalculation()
    ElMessage.success('Расчёт сохранён в истории проекта')
  } catch (e) {
    const text = describeError(e)
    ElMessage.error({ message: `Расчёт не сохранён. ${text.title}. ${text.description}`, duration: 6000 })
  }
}
</script>

<template>
  <div class="step-export">
    <EmptyState
      v-if="!hasScenarios"
      title="Нечего выгружать"
      description="Сводка строится по трём сценариям. Выберите роботов для покупки и аренды на шаге «Сравнение»."
      :icon="FolderChecked"
    >
      <el-button type="primary" @click="wizard.goTo(3)">Перейти к сравнению</el-button>
    </EmptyState>

    <el-skeleton v-else-if="!result && wizard.economicsLoading" :rows="8" animated aria-busy="true" aria-label="Считаем экономику" />

    <ErrorAlert v-else-if="!result" :error="wizard.economicsError" retry @retry="wizard.runEconomics()" />

    <template v-else>
      <el-alert v-if="wizard.mode === 'guest'" type="info" :closable="false" show-icon class="step-export__guest">
        <template #title>
          <template v-if="auth.isLoggedIn">
            Гостевой расчёт не сохраняется.
            <RouterLink :to="{ name: 'projects' }">Создайте проект</RouterLink>, чтобы сохранить расчёт,
            историю и скачать отчёт в PDF и Excel.
          </template>
          <template v-else>
            <RouterLink :to="{ name: 'register' }">Зарегистрируйтесь</RouterLink>, чтобы сохранить проект,
            историю расчётов и скачать отчёт в PDF и Excel. Уже есть учётная запись?
            <RouterLink :to="{ name: 'login', query: { redirect: '/app/projects' } }">Войдите</RouterLink>.
          </template>
        </template>
      </el-alert>

      <section v-else class="step-export__save" aria-label="Сохранение расчёта">
        <el-button
          type="primary"
          :loading="wizard.calcSaving"
          :disabled="!canSave || wizard.calculationSaved"
          @click="saveCalculation"
        >
          Сохранить расчёт
        </el-button>
        <p class="step-export__status" aria-live="polite">
          <template v-if="wizard.calculationSaved">
            <el-icon class="step-export__ok" aria-hidden="true"><CircleCheckFilled /></el-icon>
            Расчёт сохранён {{ formatDate(result.calculatedAt, true) }} и добавлен в историю расчётов.
          </template>
          <template v-else-if="wizard.calculationId">
            Параметры изменились после сохранения. Сохраните расчёт снова, чтобы отчёты соответствовали текущим данным.
          </template>
          <template v-else>
            Расчёт ещё не сохранён. Сохранённый расчёт попадает в историю проекта вместе с KPI симуляции,
            по нему формируются PDF и Excel.
          </template>
          <template v-if="wizard.hasUnsavedChanges && !wizard.calculationSaved">
            Несохранённые изменения проекта будут сохранены вместе с расчётом.
          </template>
        </p>
      </section>

      <p v-if="wizard.economicsLoading" class="step-export__busy" role="status">
        <el-icon class="is-loading" aria-hidden="true"><Loading /></el-icon> Пересчитываем…
      </p>
      <ErrorAlert v-if="wizard.economicsError" :error="wizard.economicsError" retry @retry="wizard.runEconomics()" />

      <section class="step-export__section" aria-labelledby="export-files-title">
        <h3 id="export-files-title" class="step-export__title">Выгрузка</h3>
        <ExportActions :result="result" :object-name="objectName" />
      </section>

      <ExportSummary
        :object-name="objectName"
        :process-names="processNames"
        :robots="robots"
        :result="result"
        :sim-kpi="wizard.simKpiActual"
      >
        <template #sim-empty>
          <p class="step-export__muted">
            <template v-if="!hasLayout">Для этого типа объекта симуляция пока недоступна.</template>
            <template v-else-if="simOutdated">
              Симуляция проводилась для прежних параметров — её KPI не попадут в расчёт. Запустите модель заново.
            </template>
            <template v-else>Симуляция ещё не запускалась — KPI модели не попадут в расчёт.</template>
          </p>
          <div v-if="hasLayout">
            <el-button @click="wizard.goTo(6)">Перейти к симуляции</el-button>
          </div>
        </template>
      </ExportSummary>
    </template>
  </div>
</template>

<style scoped>
.step-export {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.step-export__guest :deep(a),
.step-export__guest :deep(.el-alert__title) {
  color: var(--color-text);
}

.step-export__save {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.step-export__status {
  flex: 1 1 320px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.step-export__ok {
  color: var(--color-success);
  vertical-align: -2px;
}

.step-export__section {
  display: grid;
  gap: var(--space-2);
}

.step-export__title {
  font-size: 16px;
  font-weight: 600;
}

.step-export__busy,
.step-export__muted {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.step-export__busy {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
