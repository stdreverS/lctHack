<script setup lang="ts">
import { computed } from 'vue'
import type { MetricKey, ScenarioResult } from '@/types/api'
import { formatMetricValue, formatPayback } from '@/utils/economics'
import { EXPORT_METRICS } from '@/utils/export'

// Сводная таблица трёх сценариев: показатели сервера и вывод по каждому сценарию.
const props = defineProps<{ scenarios: ScenarioResult[] }>()

const rows = computed(() => {
  const first = props.scenarios[0]
  if (!first) return []
  return EXPORT_METRICS.filter((key) => first.metrics[key]).map((key: MetricKey) => ({
    key,
    label: first.metrics[key].label,
    cells: props.scenarios.map((s) => {
      const metric = s.metrics[key]
      return {
        id: s.id,
        value: key === 'paybackYears' ? formatPayback(metric?.value, s.kind) : formatMetricValue(metric?.value, metric?.unit ?? ''),
        overridden: metric?.overridden ?? false,
      }
    }),
  }))
})

function tone(s: ScenarioResult): string {
  return s.kind === 'baseline' ? 'neutral' : s.verdict.level
}
</script>

<template>
  <div class="export-table">
    <table class="export-table__table">
      <caption class="visually-hidden">Сравнение сценариев</caption>
      <thead>
        <tr>
          <th scope="col">Показатель</th>
          <th v-for="s in scenarios" :key="s.id" scope="col">{{ s.title }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <td v-for="cell in row.cells" :key="cell.id" class="num">
            {{ cell.value }}
            <span v-if="cell.overridden" class="export-table__manual">задано вручную</span>
          </td>
        </tr>
        <tr>
          <th scope="row">Вывод</th>
          <td v-for="s in scenarios" :key="s.id" :class="['export-table__verdict', `export-table__verdict--${tone(s)}`]">
            {{ s.verdict.label }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.export-table {
  min-width: 0;
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.export-table__table {
  width: 100%;
  border-collapse: collapse;
}

.export-table__table th,
.export-table__table td {
  padding: 8px var(--space-3);
  text-align: right;
  vertical-align: top;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.export-table__table th[scope='row'],
.export-table__table thead th:first-child {
  color: var(--color-text-secondary);
  font-weight: 400;
  text-align: left;
  white-space: normal;
}

.export-table__table thead th {
  font-weight: 600;
  border-bottom-color: var(--color-border);
}

.export-table__table tbody tr:last-child > * {
  border-bottom: 0;
}

.export-table__manual {
  display: block;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.export-table__verdict {
  font-weight: 600;
  white-space: normal;
}

.export-table__verdict--good {
  color: var(--color-success);
}

.export-table__verdict--moderate {
  color: color-mix(in srgb, var(--color-warning) 80%, black);
}

.export-table__verdict--poor,
.export-table__verdict--negative {
  color: var(--color-danger);
}

.export-table__verdict--neutral {
  color: var(--color-text-secondary);
  font-weight: 400;
}
</style>
