<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheckFilled, CircleCloseFilled, InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import type { ScenarioResult, Verdict } from '@/types/api'
import { formatMetricValue, formatPayback } from '@/utils/economics'

// Колонка сценария вверху шага «Экономика»: ключевые цифры и вывод (Verdict) сервера.
const props = defineProps<{
  scenario: ScenarioResult
  robotName: string | null
  best: boolean
}>()

const ICONS: Record<Verdict['level'], typeof CircleCheckFilled> = {
  good: CircleCheckFilled,
  moderate: WarningFilled,
  poor: CircleCloseFilled,
  negative: CircleCloseFilled,
}

const m = computed(() => props.scenario.metrics)
// Текущее состояние — точка отсчёта без окупаемости, поэтому вывод по нему нейтральный.
const tone = computed(() => (props.scenario.kind === 'baseline' ? 'neutral' : props.scenario.verdict.level))
const icon = computed(() => (props.scenario.kind === 'baseline' ? InfoFilled : ICONS[props.scenario.verdict.level]))

const figures = computed(() => [
  { key: 'capex', label: 'Капитальные затраты', value: formatMetricValue(m.value.capexRub.value, m.value.capexRub.unit) },
  { key: 'effect', label: 'Годовой эффект', value: formatMetricValue(m.value.annualEffectRub.value, m.value.annualEffectRub.unit) },
  { key: 'payback', label: 'Окупаемость', value: formatPayback(m.value.paybackYears.value, props.scenario.kind) },
  { key: 'roi', label: 'ROI за горизонт', value: formatMetricValue(m.value.roiPercent.value, m.value.roiPercent.unit) },
])
</script>

<template>
  <article class="summary" :class="{ 'summary--best': best }" :aria-label="`Сценарий «${scenario.title}»`">
    <header class="summary__head">
      <h3 class="summary__title">{{ scenario.title }}</h3>
      <span v-if="best" class="summary__best">Лучший срок окупаемости</span>
      <p class="summary__robot">{{ robotName ?? 'Без роботов, текущие процессы' }}</p>
    </header>

    <dl class="summary__figures">
      <div v-for="f in figures" :key="f.key" class="summary__figure">
        <dt>{{ f.label }}</dt>
        <dd class="num">{{ f.value }}</dd>
      </div>
    </dl>

    <section class="summary__verdict" :class="`summary__verdict--${tone}`" aria-label="Вывод">
      <p class="summary__verdict-label">
        <el-icon :size="16" aria-hidden="true"><component :is="icon" /></el-icon>
        {{ scenario.verdict.label }}
      </p>
      <p class="summary__verdict-text">{{ scenario.verdict.interpretation }}</p>
      <template v-if="scenario.verdict.risks.length">
        <p class="summary__risks-title">Риски</p>
        <ul class="summary__risks">
          <li v-for="r in scenario.verdict.risks" :key="r">{{ r }}</li>
        </ul>
      </template>
    </section>
  </article>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.summary--best {
  border-color: var(--color-primary);
  box-shadow: inset 0 3px 0 var(--color-primary);
}

.summary__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-2);
}

.summary__title {
  font-size: 16px;
  font-weight: 600;
}

.summary__best {
  padding: 0 var(--space-2);
  color: var(--color-surface);
  font-size: 12px;
  line-height: 20px;
  background: var(--color-primary);
  border-radius: var(--radius);
}

.summary__robot {
  flex-basis: 100%;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.summary__figures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.summary__figure dt {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.summary__figure dd {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.summary__verdict {
  display: grid;
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  border-left: 3px solid var(--tone);
  background: var(--tone-bg);
}

.summary__verdict--good {
  --tone: var(--color-success);
  --tone-bg: var(--el-color-success-light-9);
}

.summary__verdict--moderate {
  --tone: var(--color-warning);
  --tone-bg: var(--el-color-warning-light-9);
}

.summary__verdict--poor,
.summary__verdict--negative {
  --tone: var(--color-danger);
  --tone-bg: var(--el-color-danger-light-9);
}

.summary__verdict--neutral {
  --tone: var(--color-text-secondary);
  --tone-bg: var(--color-bg);
}

.summary__verdict-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 14px;
  font-weight: 600;
}

.summary__verdict-label .el-icon {
  color: var(--tone);
}

.summary__risks-title {
  margin-top: var(--space-1);
  font-weight: 600;
}

.summary__risks {
  padding-left: var(--space-4);
  list-style: disc;
}
</style>
