<script setup lang="ts">
import type { ScenarioResult } from '@/types/api'
import { formatPayback } from '@/utils/economics'

// Ключевая цифра шага «Экономика» — окупаемость лучшего сценария (выбран по значениям сервера).
defineProps<{ best: ScenarioResult | null }>()
</script>

<template>
  <div class="key" :class="{ 'key--none': !best }">
    <template v-if="best">
      <span class="key-label">Лучший срок окупаемости — «{{ best.title }}»</span>
      <span class="key-value num">{{ formatPayback(best.metrics.paybackYears.value, best.kind) }}</span>
    </template>
    <template v-else>
      <span class="key-label">Ни один сценарий с роботами не окупается</span>
      <span class="key-hint">Попробуйте другого робота, аренду или уточните число роботов и цену.</span>
    </template>
  </div>
</template>

<style scoped>
/* Главная цифра экрана — «разметочный» жёлтый (CLAUDE.md, раздел 8). */
.key {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 8px solid var(--color-accent);
  border-radius: var(--radius);
}

.key--none {
  border-left-color: var(--color-danger);
}

.key-label {
  font-size: 15px;
  font-weight: 600;
}

.key-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.key-hint {
  color: var(--color-text-secondary);
}
</style>
