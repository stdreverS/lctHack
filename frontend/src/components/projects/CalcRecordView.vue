<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, RefreshLeft } from '@element-plus/icons-vue'
import type { CalculationRecord } from '@/types/api'
import { getCalculation } from '@/api/calculations'
import { useWizardStore } from '@/stores/wizard'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import CashflowChart from '@/components/charts/CashflowChart.vue'
import EconAssumptions from '@/components/wizard/EconAssumptions.vue'
import ExportSummary from '@/components/wizard/ExportSummary.vue'
import { describeError } from '@/utils/errors'
import { usedRobots } from '@/utils/export'
import { formatDate } from '@/utils/format'

// Просмотр сохранённого расчёта из истории проекта (п. 3.1.5 ТЗ): результат того расчёта
// с версиями модели и данных и восстановление его параметров в проект.
const props = defineProps<{ calculationId: string }>()
const emit = defineEmits<{ close: [] }>()

const wizard = useWizardStore()
const record = ref<CalculationRecord | null>(null)
const loading = ref(false)
const error = ref<unknown>(null)
const restoring = ref(false)
const headingRef = ref<HTMLElement>()
let seq = 0

async function load() {
  const current = ++seq
  loading.value = true
  error.value = null
  record.value = null
  try {
    const [res] = await Promise.all([
      getCalculation(props.calculationId),
      wizard.loadRobots().catch(() => undefined), // названия роботов; без них покажем id
      wizard.loadObjectTypes().catch(() => undefined),
    ])
    if (current !== seq) return
    record.value = res
    await nextTick()
    headingRef.value?.focus({ preventScroll: true })
  } catch (e) {
    if (current === seq) error.value = e
  } finally {
    if (current === seq) loading.value = false
  }
}

watch(() => props.calculationId, load, { immediate: true })

const type = computed(() => wizard.objectTypes.find((t) => t.code === record.value?.request.objectType) ?? null)
const objectName = computed(() => type.value?.name ?? record.value?.request.objectType ?? '—')
const processNames = computed(() => {
  const codes = record.value?.request.processes ?? []
  return codes.map((code) => type.value?.processes.find((p) => p.code === code)?.name ?? code)
})
const robots = computed(() =>
  usedRobots(record.value?.result.scenarios ?? [], (id) => wizard.robotById.get(id)?.name ?? null),
)
const banner = computed(() => {
  const r = record.value?.result
  if (!r) return ''
  return `Расчёт от ${formatDate(record.value?.createdAt, true)}, модель ${r.modelVersion}, данные ${r.dataVersion}`
})

async function restore() {
  const current = record.value
  if (!current) return
  try {
    await ElMessageBox.confirm(
      `Параметры объекта, допущения и сценарии проекта будут заменены параметрами расчёта от ${formatDate(current.createdAt, true)}. ` +
        'Расчёт экономики будет выполнен заново по текущей версии модели, проект — сохранён.',
      'Восстановить параметры расчёта?',
      { type: 'warning', confirmButtonText: 'Восстановить', cancelButtonText: 'Отмена' },
    )
  } catch {
    return
  }
  restoring.value = true
  wizard.restoreCalculation(current)
  try {
    await wizard.save()
    ElMessage.success('Параметры восстановлены, проект сохранён')
  } catch (e) {
    const text = describeError(e)
    ElMessage.error({
      message: `Параметры восстановлены, но проект не сохранён. ${text.title}. Нажмите «Сохранить проект».`,
      duration: 6000,
    })
  } finally {
    restoring.value = false
    emit('close')
  }
}
</script>

<template>
  <section class="record" aria-labelledby="record-title">
    <header class="record__head">
      <h2 id="record-title" ref="headingRef" class="record__title" tabindex="-1">Сохранённый расчёт</h2>
      <el-button :icon="Back" @click="emit('close')">Вернуться к мастеру</el-button>
    </header>

    <ErrorAlert v-if="error" :error="error" retry @retry="load" />

    <el-skeleton v-else-if="loading || !record" :rows="8" animated aria-busy="true" aria-label="Загрузка расчёта" />

    <template v-else>
      <el-alert type="info" :closable="false" show-icon class="record__banner">
        <template #title>{{ banner }}</template>
        <p>Режим просмотра: показан результат того расчёта. Текущие параметры проекта не изменены.</p>
        <el-button type="primary" :icon="RefreshLeft" :loading="restoring" class="record__restore" @click="restore">
          Восстановить эти параметры в проект
        </el-button>
      </el-alert>

      <ExportSummary
        :object-name="objectName"
        :process-names="processNames"
        :robots="robots"
        :result="record.result"
        :sim-kpi="record.request.simulation ?? null"
      />

      <section class="record__section" aria-labelledby="record-cashflow-title">
        <h3 id="record-cashflow-title" class="record__subtitle">Накопленный денежный поток</h3>
        <CashflowChart :scenarios="record.result.scenarios" />
      </section>

      <EconAssumptions
        :assumptions="record.result.assumptionsUsed"
        :disclaimer="record.result.disclaimer"
        :model-version="record.result.modelVersion"
        :data-version="record.result.dataVersion"
      />
    </template>
  </section>
</template>

<style scoped>
.record {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.record__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.record__title {
  font-size: 20px;
  font-weight: 600;
}

.record__title:focus {
  outline: none;
}

.record__title:focus-visible {
  outline: var(--focus-ring);
}

.record__banner :deep(.el-alert__title) {
  color: var(--color-text);
  font-weight: 600;
}

.record__restore {
  margin-top: var(--space-2);
}

.record__section {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.record__subtitle {
  font-size: 16px;
  font-weight: 600;
}
</style>
