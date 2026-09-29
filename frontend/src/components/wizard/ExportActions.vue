<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document, Download, Picture, Tickets } from '@element-plus/icons-vue'
import type { CalcResult } from '@/types/api'
import { useWizardStore } from '@/stores/wizard'
import { REPORTS_AVAILABLE, getExportXlsxUrl } from '@/api/calculations'
import { buildTimeline } from '@/sim/renderer'
import { renderSchemePng } from '@/sim/snapshot'
import { SIM_HOURS } from '@/utils/simInput'
import { saveBlob, saveObjectUrl } from '@/utils/download'
import { describeError } from '@/utils/errors'
import { exportFileName, scenariosCsv } from '@/utils/export'

// Кнопки выгрузки шага «Экспорт». PDF — из печатной версии отчёта (views/ReportView.vue);
// Excel формирует сервер по сохранённому расчёту; CSV и схема PNG собираются в браузере.
const props = defineProps<{ result: CalcResult; objectName: string }>()

const wizard = useWizardStore()
const router = useRouter()
const busy = ref<'report' | 'xlsx' | 'png' | null>(null)

const excelReady = computed(() => REPORTS_AVAILABLE && wizard.mode === 'project' && wizard.calculationSaved)
const excelHint = computed(() => {
  if (!REPORTS_AVAILABLE) return 'Excel формирует сервер, в демо-режиме недоступно.'
  if (wizard.mode === 'guest') return 'Excel доступен в проекте после сохранения расчёта.'
  return wizard.calculationSaved ? '' : 'Сначала сохраните расчёт — Excel формируется по сохранённой версии.'
})
const layout = computed(() => wizard.currentType?.layout ?? null)

/** Печатная версия отчёта; несохранённые параметры проекта сначала сохраняются. */
async function openReport() {
  if (busy.value) return
  busy.value = 'report'
  try {
    if (wizard.mode === 'project' && wizard.projectId) {
      if (wizard.hasUnsavedChanges) await wizard.save()
      await router.push({ name: 'project-report', params: { id: wizard.projectId } })
    } else {
      await router.push({ name: 'demo-report' })
    }
  } catch (e) {
    const text = describeError(e)
    ElMessage.error({ message: `Проект не сохранён, отчёт не открыт. ${text.title}. ${text.description}`, duration: 6000 })
  } finally {
    busy.value = null
  }
}

async function downloadExcel() {
  const id = wizard.calculationId
  if (!excelReady.value || !id || busy.value) return
  busy.value = 'xlsx'
  try {
    saveObjectUrl(await getExportXlsxUrl(id), exportFileName('robo-calculation', 'xlsx'))
  } catch (e) {
    const text = describeError(e)
    ElMessage.error({ message: `Файл не скачан. ${text.title}. ${text.description}`, duration: 6000 })
  } finally {
    busy.value = null
  }
}

function downloadCsv() {
  const csv = scenariosCsv(props.result, {
    objectName: props.objectName,
    robotName: (id) => wizard.robotById.get(id)?.name ?? null,
  })
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), exportFileName('robo-scenarios', 'csv'))
}

/** План объекта; если модель прогнана — роботы в середине пикового часа. */
async function downloadPng() {
  const plan = layout.value
  if (!plan || busy.value) return
  busy.value = 'png'
  try {
    const sim = wizard.simResult
    const timeline = sim ? buildTimeline(sim.segments, SIM_HOURS * 3600) : null
    const blob = await renderSchemePng({ layout: plan, timeline, timeSec: timeline ? timeline.durationSec / 2 : 0 })
    if (!blob) throw new Error('canvas')
    saveBlob(blob, exportFileName(`robo-scheme-${wizard.objectType ?? 'object'}`, 'png'))
  } catch {
    ElMessage.error('Не удалось сформировать изображение схемы. Обновите страницу и повторите попытку.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="export-actions">
    <div class="export-actions__group">
      <el-button type="primary" :icon="Document" :loading="busy === 'report'" @click="openReport">
        Отчёт для печати и PDF
      </el-button>
      <el-button :icon="Tickets" :disabled="!excelReady" :loading="busy === 'xlsx'" @click="downloadExcel">
        Скачать Excel
      </el-button>
      <p class="export-actions__hint">
        PDF формируется из печатной версии отчёта: откройте её и нажмите «Скачать PDF».
        <template v-if="excelHint">{{ excelHint }}</template>
      </p>
    </div>

    <div class="export-actions__group">
      <el-button :icon="Download" @click="downloadCsv">Скачать CSV</el-button>
      <el-button :icon="Picture" :disabled="!layout" :loading="busy === 'png'" @click="downloadPng">
        Скачать схему PNG
      </el-button>
      <p class="export-actions__hint">
        CSV — таблица сравнения сценариев, открывается в Excel.
        <template v-if="!layout">Схема объекта для этого типа пока не подготовлена.</template>
        <template v-else-if="!wizard.simResult">На схеме будет только план: симуляция ещё не запускалась.</template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.export-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-3) var(--space-5);
}

.export-actions__group {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: var(--space-2);
}

.export-actions__group .el-button + .el-button {
  margin-left: 0;
}

.export-actions__hint {
  flex-basis: 100%;
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
