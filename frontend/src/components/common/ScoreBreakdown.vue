<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreFactor } from '@/types/api'
import { formatNumber, formatPercent } from '@/utils/format'
import { contributionBars } from '@/utils/recommendation'

// Вклад факторов в итоговый балл. Светлая полоса — наибольший возможный вклад (вес × 100),
// тёмная — фактический вклад.
const props = defineProps<{ factors: ScoreFactor[] }>()

const rows = computed(() => {
  const bars = contributionBars(props.factors)
  return props.factors.map((f, i) => ({ ...f, bar: bars[i]! }))
})
</script>

<template>
  <ul class="score-breakdown">
    <li v-for="f in rows" :key="f.factor" class="score-breakdown__row">
      <span class="score-breakdown__label">
        {{ f.label }}
        <span class="score-breakdown__weight">вес {{ formatPercent(f.weight * 100, 0) }}</span>
      </span>
      <span
        class="score-breakdown__track"
        :style="{ width: `${f.bar.track}%` }"
        role="img"
        :aria-label="`${f.label}: оценка ${formatNumber(f.value, 0)} из 100, вклад ${formatNumber(f.contribution, 1)} балла`"
      >
        <span class="score-breakdown__fill" :style="{ width: `${f.bar.track ? (f.bar.fill / f.bar.track) * 100 : 0}%` }"></span>
      </span>
      <span class="score-breakdown__value num">+{{ formatNumber(f.contribution, 1) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.score-breakdown {
  display: grid;
  gap: var(--space-2);
}

.score-breakdown__row {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--space-3);
  row-gap: 2px;
  align-items: center;
}

.score-breakdown__label {
  grid-column: 1 / -1;
  font-size: 13px;
}

.score-breakdown__weight {
  margin-left: var(--space-1);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.score-breakdown__track {
  display: block;
  height: 8px;
  background: var(--el-color-primary-light-9);
  border-radius: 2px;
}

.score-breakdown__fill {
  display: block;
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
}

.score-breakdown__value {
  min-width: 40px;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-align: right;
}
</style>
