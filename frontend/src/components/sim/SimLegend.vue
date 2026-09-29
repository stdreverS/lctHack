<script setup lang="ts">
import type { SegmentState } from '@/types/sim'
import { ROBOT_STATE_LABELS } from '@/sim/renderer'

// Что означают цвета на плане: цвет не единственный носитель смысла.
const STATES: SegmentState[] = ['moving_loaded', 'moving_empty', 'handling', 'charging', 'idle']
</script>

<template>
  <ul class="legend">
    <li v-for="state in STATES" :key="state" class="legend__item">
      <span class="legend__dot" :class="`legend__dot--${state}`" aria-hidden="true"></span>
      {{ ROBOT_STATE_LABELS[state] }}
    </li>
    <li class="legend__item">
      <span class="legend__line" aria-hidden="true"></span>
      Маршрут гружёного робота
    </li>
  </ul>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend__dot--idle {
  background: var(--color-robot-idle);
}

.legend__dot--moving_empty {
  background: var(--color-robot-moving-empty);
}

.legend__dot--moving_loaded {
  background: var(--color-robot-moving-loaded);
}

.legend__dot--handling {
  background: var(--color-robot-handling);
}

.legend__dot--charging {
  background: var(--color-robot-charging);
}

.legend__line {
  width: 18px;
  height: 0;
  border-top: 2px dashed var(--color-accent);
}
</style>
