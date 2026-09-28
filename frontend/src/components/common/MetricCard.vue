<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { ArrowDown, ArrowRight, EditPen } from '@element-plus/icons-vue'
import type { AssumptionRef, Metric } from '@/types/api'
import { formatMetricValue, metricInputs } from '@/utils/economics'

// Метрика расчёта: подпись и значение; по клику раскрываются формула, исходные данные и состав.
const props = defineProps<{
  metric: Metric
  /** Для подписей исходных данных. */
  assumptions?: AssumptionRef[]
  /** Текст вместо значения (например, «не окупается»). */
  valueText?: string
}>()

defineSlots<{ actions?: () => unknown }>()

const open = ref(false)
const detailsId = useId()

const value = computed(() => props.valueText ?? formatMetricValue(props.metric.value, props.metric.unit))
const inputs = computed(() => metricInputs(props.metric, props.assumptions))
</script>

<template>
  <div class="metric" :class="{ 'metric--overridden': metric.overridden }">
    <button type="button" class="metric__head" :aria-expanded="open" :aria-controls="detailsId" @click="open = !open">
      <span class="metric__label">
        <el-icon class="metric__chevron" aria-hidden="true"><component :is="open ? ArrowDown : ArrowRight" /></el-icon>
        {{ metric.label }}
      </span>
      <span class="metric__value num">{{ value }}</span>
    </button>

    <div class="metric__meta">
      <span v-if="metric.overridden" class="metric__manual">
        <el-icon aria-hidden="true"><EditPen /></el-icon>изменено вручную
      </span>
      <slot name="actions" />
    </div>

    <div v-show="open" :id="detailsId" class="metric__details">
      <p class="metric__formula"><span class="metric__caption">Формула:</span> {{ metric.formula }}</p>
      <template v-if="inputs.length">
        <p class="metric__caption">Исходные данные</p>
        <dl class="metric__list">
          <template v-for="row in inputs" :key="row.key">
            <dt>{{ row.label }}</dt>
            <dd class="num">{{ row.value }}</dd>
          </template>
        </dl>
      </template>
      <template v-if="metric.breakdown?.length">
        <p class="metric__caption">Из чего складывается</p>
        <dl class="metric__list">
          <template v-for="b in metric.breakdown" :key="b.key">
            <dt>
              {{ b.label }}
              <span v-if="b.source" class="metric__source">источник: {{ b.source }}</span>
            </dt>
            <dd class="num">{{ formatMetricValue(b.value, metric.unit) }}</dd>
          </template>
        </dl>
      </template>
    </div>
  </div>
</template>

<style scoped>
.metric {
  display: grid;
  align-content: start;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.metric--overridden {
  border-style: dashed;
  border-color: var(--color-warning);
}

.metric__head {
  display: grid;
  gap: 2px;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.metric__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.metric__chevron {
  flex: none;
}

.metric__value {
  font-size: 18px;
  font-weight: 600;
}

.metric__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.metric__meta:empty {
  display: none;
}

.metric__manual {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 var(--space-1);
  font-size: 12px;
  color: var(--color-text);
  background: var(--el-color-warning-light-9);
  border-radius: 2px;
}

.metric__details {
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  font-size: 13px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.metric__caption {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.metric__list {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px var(--space-3);
  margin: 0;
}

.metric__list dd {
  margin: 0;
  text-align: right;
}

.metric__source {
  display: block;
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>
