<script setup lang="ts">
import { computed } from 'vue'
import { Bottom, Top } from '@element-plus/icons-vue'
import type { ScenarioResult } from '@/types/api'
import { formatMetricValue, formatPayback } from '@/utils/economics'
import { compareScenarios, type CompareCell, type CompareRow } from '@/utils/whatif'

// Все сценарии в одной таблице: строки — показатели, столбцы — сценарии.
// Лучшее значение строки выделено, изменение к прошлому расчёту — стрелкой и разницей.
const props = defineProps<{
  scenarios: ScenarioResult[]
  previous: ScenarioResult[] | null
}>()

const rows = computed(() => compareScenarios(props.scenarios, props.previous))

function valueText(row: CompareRow, cell: CompareCell, index: number): string {
  if (row.key === 'paybackYears') return formatPayback(cell.value, props.scenarios[index]!.kind)
  return formatMetricValue(cell.value, row.unit)
}

function deltaText(row: CompareRow, cell: CompareCell): string {
  if (cell.delta === null) return ''
  const sign = cell.delta > 0 ? '+' : '−'
  return `${sign}${formatMetricValue(Math.abs(cell.delta), row.unit)}`
}
</script>

<template>
  <div class="compare">
    <div class="compare__scroll" tabindex="0" aria-label="Сравнение сценариев">
      <table class="compare__table">
        <thead>
          <tr>
            <th scope="col">Показатель</th>
            <th v-for="s in scenarios" :key="s.id" scope="col">{{ s.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <th scope="row">{{ row.label }}</th>
            <td
              v-for="(cell, i) in row.cells"
              :key="cell.scenarioId"
              :class="{ 'compare__cell--best': cell.best }"
            >
              <span class="compare__value num">{{ valueText(row, cell, i) }}</span>
              <span v-if="cell.best" class="compare__best-mark">лучшее</span>
              <span v-if="cell.overridden" class="compare__manual">изменено вручную</span>
              <span
                v-if="cell.delta !== null"
                class="compare__delta num"
                :class="cell.improved ? 'compare__delta--better' : 'compare__delta--worse'"
              >
                <el-icon :size="12" aria-hidden="true">
                  <component :is="cell.delta > 0 ? Top : Bottom" />
                </el-icon>
                {{ deltaText(row, cell) }}
                <span class="visually-hidden">{{ cell.improved ? 'стало лучше' : 'стало хуже' }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="compare__legend">
      «Лучшее» сравнивается только между сценариями с роботами.
      <template v-if="previous">Стрелка — разница с предыдущим расчётом на этом шаге.</template>
      <template v-else>После первого пересчёта появится разница с предыдущим расчётом.</template>
    </p>
  </div>
</template>

<style scoped>
.compare {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.compare__scroll {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.compare__table {
  width: 100%;
  border-collapse: collapse;
}

.compare__table th,
.compare__table td {
  padding: 8px var(--space-3);
  text-align: right;
  vertical-align: top;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.compare__table th[scope='row'],
.compare__table thead th:first-child {
  text-align: left;
  font-weight: 400;
  color: var(--color-text-secondary);
  white-space: normal;
}

.compare__table thead th {
  position: sticky;
  top: 0;
  background: var(--color-surface);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.compare__cell--best {
  background: var(--el-color-success-light-9);
  box-shadow: inset 3px 0 0 var(--color-success);
}

.compare__value {
  display: block;
  font-weight: 600;
}

.compare__best-mark {
  display: block;
  color: color-mix(in srgb, var(--color-success) 75%, black);
  font-size: 11px;
}

.compare__manual {
  display: block;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.compare__delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
}

.compare__delta--better {
  color: color-mix(in srgb, var(--color-success) 80%, black);
}

.compare__delta--worse {
  color: var(--color-danger);
}
</style>
