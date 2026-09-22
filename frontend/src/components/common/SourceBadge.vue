<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '@/utils/format'
import { dataStatusLabel } from '@/utils/robotSpecs'

// Статус происхождения значения: «Подтверждено» (есть проверенный источник) или «Допущение».
// Подходит и для каталога роботов, и для ParamField.defaultSource.
const props = defineProps<{
  confirmed: boolean
  /** Название источника или ссылка. */
  source?: string | null
  /** Дата данных, ISO 8601. */
  date?: string | null
}>()

const label = computed(() => dataStatusLabel(props.confirmed))

const details = computed(() => {
  const parts = [
    props.confirmed
      ? 'Значение подтверждено источником'
      : 'Значение принято как допущение — уточните его у поставщика',
  ]
  parts.push(props.source ? `Источник: ${props.source}` : 'Источник не указан')
  if (props.date) parts.push(`Дата данных: ${formatDate(props.date)}`)
  return parts.join('. ')
})
</script>

<template>
  <el-tooltip :content="details" placement="top" :show-after="200">
    <span
      class="source-badge"
      :class="confirmed ? 'source-badge--confirmed' : 'source-badge--assumption'"
      tabindex="0"
      :aria-label="`${label}. ${details}`"
    >
      <span class="source-badge__dot" aria-hidden="true"></span>{{ label }}
    </span>
  </el-tooltip>
</template>

<style scoped>
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--space-2);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  border: 1px solid currentColor;
  border-radius: var(--radius);
  cursor: help;
}

.source-badge__dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
}

.source-badge--confirmed {
  color: var(--color-success);
}

.source-badge--assumption {
  color: var(--color-warning);
}
</style>
