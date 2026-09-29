<script setup lang="ts">
import type { Robot } from '@/types/api'
import { NO_DATA, type ComparisonGroup } from '@/utils/robotSpecs'

// Таблица сравнения роботов по группам характеристик; отличающиеся строки выделены.
// Заголовок столбца робота задаётся слотом #robot (по умолчанию — название).
defineProps<{
  robots: Robot[]
  groups: ComparisonGroup[]
  /** Ограничение высоты с прокруткой внутри (например, в диалоге). */
  maxHeight?: string
}>()

defineSlots<{ robot?: (props: { robot: Robot }) => unknown }>()
</script>

<template>
  <div class="compare-table" :style="maxHeight ? { maxHeight } : undefined" tabindex="0" aria-label="Таблица сравнения">
    <table class="compare-table__table">
      <thead>
        <tr>
          <th scope="col" class="compare-table__label-col">Характеристика</th>
          <th v-for="robot in robots" :key="robot.id" scope="col" class="compare-table__robot">
            <slot name="robot" :robot="robot">{{ robot.name }}</slot>
          </th>
        </tr>
      </thead>
      <tbody v-for="group in groups" :key="group.key">
        <tr class="compare-table__group">
          <th :colspan="robots.length + 1" scope="colgroup">{{ group.label }}</th>
        </tr>
        <tr v-for="row in group.rows" :key="row.key" :class="{ 'compare-table__row--diff': row.differs }">
          <th scope="row" class="compare-table__label-col">{{ row.label }}</th>
          <td v-for="(value, i) in row.values" :key="i" :class="{ 'no-data': value === NO_DATA }">{{ value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.compare-table {
  overflow: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.compare-table__table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.compare-table__table th,
.compare-table__table td {
  padding: 6px var(--space-3);
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.compare-table__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.compare-table__label-col {
  width: 240px;
  min-width: 200px;
  color: var(--color-text-secondary);
  font-weight: 400;
}

.compare-table__robot {
  min-width: 180px;
  font-weight: 600;
}

.compare-table__group th {
  padding-top: var(--space-3);
  background: var(--color-bg);
  font-weight: 600;
}

.compare-table__row--diff > * {
  background: var(--el-color-primary-light-9);
}

.compare-table__row--diff > th {
  box-shadow: inset 3px 0 0 var(--color-primary);
  color: var(--color-text);
}

.no-data {
  color: var(--color-text-secondary);
}
</style>
