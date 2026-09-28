<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheckFilled, WarningFilled } from '@element-plus/icons-vue'
import type { SimKpi } from '@/types/api'
import QueueChart from '@/components/charts/QueueChart.vue'
import { formatNumber, formatPercent, pluralRobots } from '@/utils/format'

// Итог прогона: вердикт, KPI, очередь по минутам и загрузка каждого робота.
const props = defineProps<{
  kpi: SimKpi
  queueByMinute: number[]
  robotsUtilization: number[]
  /** Число роботов сценария — из расчёта экономики. */
  robotCount: number
  /** Можно предложить пересчёт с большим парком. */
  canRecalc: boolean
}>()

const emit = defineEmits<{ recalc: [count: number] }>()

const single = computed(() => props.robotCount % 10 === 1 && props.robotCount % 100 !== 11)
const verdict = computed(() => {
  const count = props.robotCount
  const phrase =
    `${count} ${pluralRobots(count)} ${single.value ? 'обеспечивает' : 'обеспечивают'} ` +
    `${formatPercent(props.kpi.achievedPercent)} целевой производительности`
  return props.kpi.confirmsCalculation
    ? { ok: true, text: `Расчёт подтверждён: ${phrase}` }
    : { ok: false, text: `Расчёт не подтверждён: ${phrase}` }
})

const nextCount = computed(() => props.robotCount + 1)

const figures = computed(() => [
  {
    key: 'throughput',
    label: 'Производительность модели',
    value: `${formatNumber(props.kpi.throughputPerHour, 1)} опер./ч`,
    note: `цель — ${formatNumber(props.kpi.targetPerHour, 1)} опер./ч`,
  },
  {
    key: 'achieved',
    label: 'Достигнуто от цели',
    value: formatPercent(props.kpi.achievedPercent),
    note: props.kpi.confirmsCalculation ? 'парк справляется' : 'парк не закрывает поток',
  },
  {
    key: 'utilization',
    label: 'Средняя загрузка роботов',
    value: formatPercent(props.kpi.avgUtilization * 100),
    note: 'переезды и операции с грузом',
  },
  {
    key: 'idle',
    label: 'Простой',
    value: formatPercent(props.kpi.idleShare * 100),
    note: 'в том числе ожидание зарядного места',
  },
  {
    key: 'charging',
    label: 'Зарядка',
    value: formatPercent(props.kpi.chargingShare * 100),
    note: 'с дорогой к зарядным местам',
  },
  {
    key: 'queue',
    label: 'Наибольшая очередь',
    value: `${formatNumber(props.kpi.maxQueue, 0)} заявок`,
    note: 'пик за прогон',
  },
])

/** Ширина полоски загрузки, % — от наибольшей загрузки в парке. */
const bars = computed(() => {
  const max = Math.max(0.01, ...props.robotsUtilization)
  return props.robotsUtilization.map((value, index) => ({
    id: index,
    value,
    width: Math.round((value / max) * 100),
  }))
})
</script>

<template>
  <div class="kpi">
    <section class="kpi__verdict" :class="verdict.ok ? 'kpi__verdict--ok' : 'kpi__verdict--fail'" aria-label="Вывод симуляции">
      <p class="kpi__verdict-text">
        <el-icon :size="18" aria-hidden="true">
          <component :is="verdict.ok ? CircleCheckFilled : WarningFilled" />
        </el-icon>
        {{ verdict.text }}
      </p>
      <p class="kpi__bottleneck">{{ kpi.bottleneck }}</p>
      <el-button v-if="!verdict.ok && canRecalc" type="primary" @click="emit('recalc', nextCount)">
        Пересчитать с {{ nextCount }} {{ pluralRobots(nextCount, 'instrumental') }}
      </el-button>
    </section>

    <dl class="kpi__figures">
      <div v-for="f in figures" :key="f.key" class="kpi__figure">
        <dt>{{ f.label }}</dt>
        <dd class="num">{{ f.value }}</dd>
        <p class="kpi__note">{{ f.note }}</p>
      </div>
    </dl>

    <section class="kpi__section" aria-labelledby="sim-queue-title">
      <h4 id="sim-queue-title" class="kpi__title">Очередь заявок по минутам</h4>
      <QueueChart :queue-by-minute="queueByMinute" />
    </section>

    <section v-if="bars.length" class="kpi__section" aria-labelledby="sim-robots-title">
      <h4 id="sim-robots-title" class="kpi__title">Загрузка каждого робота</h4>
      <ul class="kpi__robots">
        <li v-for="bar in bars" :key="bar.id" class="kpi__robot">
          <span class="kpi__robot-name">Робот {{ bar.id + 1 }}</span>
          <span class="kpi__bar" aria-hidden="true"><span class="kpi__bar-fill" :style="{ width: `${bar.width}%` }"></span></span>
          <span class="kpi__robot-value num">{{ formatPercent(bar.value * 100) }}</span>
        </li>
      </ul>
    </section>

    <p class="kpi__meta">Движок {{ kpi.engineVersion }}, зерно прогона {{ kpi.seed }}.</p>
  </div>
</template>

<style scoped>
.kpi {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.kpi__verdict {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-left-width: 3px;
  border-radius: var(--radius);
}

.kpi__verdict--ok {
  background: var(--el-color-success-light-9);
  border-left-color: var(--color-success);
}

.kpi__verdict--fail {
  background: var(--el-color-warning-light-9);
  border-left-color: var(--color-warning);
}

.kpi__verdict-text {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}

.kpi__bottleneck,
.kpi__note,
.kpi__meta {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.kpi__figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
  margin: 0;
}

.kpi__figure {
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.kpi__figure dt {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.kpi__figure dd {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 600;
}

.kpi__section {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.kpi__title {
  font-size: 14px;
  font-weight: 600;
}

.kpi__robots {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.kpi__robot {
  display: grid;
  grid-template-columns: 90px 1fr 60px;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
}

.kpi__robot-value {
  text-align: right;
}

.kpi__bar {
  display: block;
  height: 10px;
  background: var(--el-border-color-lighter);
  border-radius: 2px;
}

.kpi__bar-fill {
  display: block;
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
}
</style>
