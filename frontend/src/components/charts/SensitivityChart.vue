<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import type { SensParam, SensitivitySeries } from '@/types/api'
import { formatPercent, formatYears } from '@/utils/format'
import { SENS_LABELS, pointsWithZero } from '@/utils/whatif'

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend)

// Окупаемость сценария при отклонении параметра на −20…+20 %.
const props = defineProps<{
  series: SensitivitySeries[]
  /** Срок окупаемости сценария без отклонений — точка «0 %». */
  currentPaybackYears: number | null
}>()

const SERIES: Record<SensParam, { cssVar: string; dash: number[]; point: 'circle' | 'rect' | 'triangle' }> = {
  equipmentPrice: { cssVar: '--color-sens-equipment', dash: [], point: 'rect' },
  operationsVolume: { cssVar: '--color-sens-volume', dash: [6, 4], point: 'triangle' },
  laborCost: { cssVar: '--color-sens-labor', dash: [2, 3], point: 'circle' },
}

const colors = ref<Record<string, string>>({})
const textColor = ref('#5b6b77')
const gridColor = ref('#d5dce1')
const inkColor = ref('#1e2a33')
const showTable = ref(false)

onMounted(() => {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  colors.value = Object.fromEntries(Object.values(SERIES).map((s) => [s.cssVar, read(s.cssVar, '#2f5d7c')]))
  textColor.value = read('--color-text-secondary', textColor.value)
  gridColor.value = read('--color-border', gridColor.value)
  inkColor.value = read('--color-text', inkColor.value)
})

const colorOf = (param: SensParam) => colors.value[SERIES[param].cssVar] ?? '#2f5d7c'
const pointsOf = (s: SensitivitySeries) => pointsWithZero(s.points, props.currentPaybackYears)
const deltas = computed(() => [...new Set(props.series.flatMap((s) => pointsOf(s).map((p) => p.delta)))].sort((a, b) => a - b))
const labelOf = (s: SensitivitySeries) => s.label || SENS_LABELS[s.param]

const data = computed<ChartData<'line', { x: number; y: number | null }[]>>(() => ({
  datasets: props.series.map((s) => ({
    label: labelOf(s),
    data: pointsOf(s).map((p) => ({ x: Math.round(p.delta * 100), y: p.paybackYears })),
    borderColor: colorOf(s.param),
    backgroundColor: colorOf(s.param),
    borderWidth: 2,
    borderDash: SERIES[s.param].dash,
    pointStyle: SERIES[s.param].point,
    pointRadius: 5,
    pointHoverRadius: 7,
    tension: 0,
    spanGaps: false,
  })),
}))

const options = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'nearest', intersect: false, axis: 'x' },
  scales: {
    x: {
      type: 'linear',
      ticks: {
        color: textColor.value,
        callback: (v) => (Number(v) > 0 ? `+${v} %` : `${v} %`),
      },
      grid: { color: (ctx) => (ctx.tick.value === 0 ? inkColor.value : gridColor.value) },
      border: { color: gridColor.value },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Срок окупаемости, лет', color: textColor.value },
      ticks: { color: textColor.value },
      grid: { color: gridColor.value },
      border: { display: false },
    },
  },
  plugins: {
    legend: { position: 'top', align: 'start', labels: { usePointStyle: true, color: inkColor.value } },
    tooltip: {
      callbacks: {
        title: (items) =>
          items[0]?.parsed.x === 0
            ? 'Без отклонения — текущий расчёт'
            : `Отклонение ${Number(items[0]?.parsed.x) > 0 ? '+' : ''}${items[0]?.parsed.x} %`,
        label: (item) => `${item.dataset.label}: ${formatYears(item.parsed.y)}`,
      },
    },
  },
}))

const ariaLabel = computed(
  () =>
    'График чувствительности окупаемости. ' +
    props.series
      .map((s) => `${labelOf(s)}: ${pointsOf(s).map((p) => `${formatPercent(p.delta * 100, 0)} — ${p.paybackYears === null ? 'не окупается' : formatYears(p.paybackYears)}`).join(', ')}`)
      .join('. '),
)

function cell(s: SensitivitySeries, delta: number): string {
  const point = pointsOf(s).find((p) => p.delta === delta)
  if (!point) return '—'
  return point.paybackYears === null ? 'не окупается' : formatYears(point.paybackYears)
}
</script>

<template>
  <figure class="sens">
    <div class="sens__canvas">
      <Line :data="data" :options="options" role="img" :aria-label="ariaLabel" />
    </div>
    <figcaption class="sens__caption">
      Разрыв линии означает, что при таком отклонении сценарий не окупается.
      <el-button link type="primary" :aria-expanded="showTable" @click="showTable = !showTable">
        {{ showTable ? 'Скрыть таблицу' : 'Показать таблицей' }}
      </el-button>
    </figcaption>
    <div v-if="showTable" class="sens__table-wrap">
      <table class="sens__table">
        <thead>
          <tr>
            <th scope="col">Параметр</th>
            <th v-for="d in deltas" :key="d" scope="col">
              {{ d === 0 ? 'текущий' : `${d > 0 ? '+' : ''}${Math.round(d * 100)} %` }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in series" :key="s.param">
            <th scope="row">{{ labelOf(s) }}</th>
            <td v-for="d in deltas" :key="d">{{ cell(s, d) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.sens {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.sens__canvas {
  position: relative;
  height: 300px;
}

.sens__caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.sens__table-wrap {
  overflow-x: auto;
}

.sens__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.sens__table th,
.sens__table td {
  padding: 4px var(--space-2);
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.sens__table th[scope='row'],
.sens__table thead th:first-child {
  text-align: left;
}
</style>
