<script setup lang="ts">
import { useId } from 'vue'
import type { AssumptionRef } from '@/types/api'
import SourceBadge from '@/components/common/SourceBadge.vue'
import { formatNumber } from '@/utils/format'

// Допущения и источники расчёта (assumptionsUsed) и оговорка сервера.
defineProps<{ assumptions: AssumptionRef[]; disclaimer: string; modelVersion: string; dataVersion: string }>()

// Блок может быть на странице дважды (мастер и расчёт из истории) — id уникальны.
const titleId = useId()

function value(a: AssumptionRef): string {
  const v = typeof a.value === 'number' ? formatNumber(a.value) : a.value
  return a.unit ? `${v} ${a.unit}` : v
}
</script>

<template>
  <section class="assumptions" :aria-labelledby="titleId">
    <h3 :id="titleId" class="assumptions__title">Допущения и источники</h3>
    <div class="assumptions__table-wrap">
      <table class="assumptions__table">
        <thead>
          <tr>
            <th scope="col">Допущение</th>
            <th scope="col" class="assumptions__num">Значение</th>
            <th scope="col">Источник</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in assumptions" :key="a.key">
            <th scope="row">{{ a.label }}</th>
            <td class="assumptions__num">{{ value(a) }}</td>
            <td>
              <span class="assumptions__source">
                <SourceBadge :confirmed="a.confirmed" :source="a.source" />
                {{ a.source }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="assumptions__disclaimer" role="note">{{ disclaimer }}</p>
    <p class="assumptions__version">Модель {{ modelVersion }}, данные каталога {{ dataVersion }}</p>
  </section>
</template>

<style scoped>
.assumptions {
  display: grid;
  gap: var(--space-2);
}

.assumptions__title {
  font-size: 16px;
  font-weight: 600;
}

.assumptions__table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.assumptions__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.assumptions__table th,
.assumptions__table td {
  padding: 5px var(--space-3);
  text-align: left;
  font-weight: 400;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.assumptions__table thead th {
  color: var(--color-text-secondary);
}

.assumptions__num {
  text-align: right !important;
  white-space: nowrap;
}

.assumptions__source {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.assumptions__disclaimer {
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-text-secondary);
}

.assumptions__version {
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>
