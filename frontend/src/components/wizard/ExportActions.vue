<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Download, Picture, Tickets } from '@element-plus/icons-vue'
import type { CalcResult } from '@/types/api'
import { useWizardStore } from '@/stores/wizard'
import { REPORTS_AVAILABLE, getExportXlsxUrl, getReportPdfUrl } from '@/api/calculations'
import { buildTimeline } from '@/sim/renderer'
import { renderSchemePng } from '@/sim/snapshot'
import { SIM_HOURS } from '@/utils/simInput'
import { saveBlob, saveObjectUrl } from '@/utils/download'
import { describeError } from '@/utils/errors'
import { exportFileName, scenariosCsv } from '@/utils/export'

// Кнопки выгрузки шага «Экспорт». PDF и Excel формирует сервер по сохранённому расчёту;
// CSV и схема PNG собираются в браузере из уже полученных данных.
const props = defineProps<{ result: CalcResult; objectName: string }>()

const wizard = useWizardStore()
const busy = ref<'pdf' | 'xlsx' | 'png' | null>(null)

const reportsReady = computed(() => wizard.mode === 'project' && wizard.calculationSaved)
const reportsHint = computed(() => {
  if (wizard.mode === 'guest') return 'PDF и Excel доступны в проекте после сохранения расчёта.'
  if (!wizard.calculationSaved) return 'Сначала сохраните расчёт — отчёт формируется по сохранённой версии.'
  return REPORTS_AVAILABLE ? '' : 'Демо-режим: отчёты формирует сервер, они появятся после подключения бэкенда.'
})
const layout = computed(() => wizard.currentType?.layout ?? null)

async function downloadReport(kind: 'pdf' | 'xlsx') {
  if (!REPORTS_AVAILABLE) {
    ElMessage.info('Отчёты формирует сервер, доступно после подключения бэкенда')
    return
  }
  const id = wizard.calculationId
  if (!id || busy.value) return
  busy.value = kind
  try {
    const url = kind === 'pdf' ? await getReportPdfUrl(id) : await getExportXlsxUrl(id)
    saveObjectUrl(url, exportFileName(kind === 'pdf' ? 'robo-report' : 'robo-calculation', kind))
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
      <el-button :icon="Document" :disabled="!reportsReady" :loading="busy === 'pdf'" @click="downloadReport('pdf')">
        Скачать PDF
      </el-button>
      <el-button :icon="Tickets" :disabled="!reportsReady" :loading="busy === 'xlsx'" @click="downloadReport('xlsx')">
        Скачать Excel
      </el-button>
      <p v-if="reportsHint" class="export-actions__hint">{{ reportsHint }}</p>
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
