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
import type { ScenarioKind, ScenarioResult } from '@/types/api'
import { formatNumber, formatRub, formatYears } from '@/utils/format'

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend)

// Накопленный денежный поток по годам для всех сценариев. Точка окупаемости — значение
// paybackYears с сервера на нулевой линии; рядом с графиком — та же информация таблицей.
const props = defineProps<{ scenarios: ScenarioResult[] }>()

const SERIES: Record<ScenarioKind, { cssVar: string; dash: number[]; point: 'circle' | 'rect' | 'triangle' }> = {
  baseline: { cssVar: '--color-series-baseline', dash: [6, 4], point: 'circle' },
  purchase: { cssVar: '--color-series-purchase', dash: [], point: 'rect' },
  raas: { cssVar: '--color-series-raas', dash: [], point: 'triangle' },
}

const colors = ref<Record<string, string>>({})
const textColor = ref('#5b6b77')
const gridColor = ref('#d5dce1')
const inkColor = ref('#1e2a33')
const showTable = ref(false)

onMounted(() => {
  // Chart.js рисует на canvas и не понимает CSS-переменные — читаем их значения.
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  colors.value = Object.fromEntries(
    Object.values(SERIES).map((s) => [s.cssVar, read(s.cssVar, '#2f5d7c')]),
  )
  textColor.value = read('--color-text-secondary', textColor.value)
  gridColor.value = read('--color-border', gridColor.value)
  inkColor.value = read('--color-text', inkColor.value)
})

const colorOf = (kind: ScenarioKind) => colors.value[SERIES[kind].cssVar] ?? '#2f5d7c'

function millions(value: number): string {
  return `${formatNumber(value / 1_000_000, 1)} млн ₽`
}

const years = computed(() => [...new Set(props.scenarios.flatMap((s) => s.cashflow.map((c) => c.year)))].sort((a, b) => a - b))
const horizon = computed(() => Math.max(0, ...years.value))

const data = computed<ChartData<'line', { x: number; y: number }[]>>(() => ({
  datasets: [
    ...props.scenarios.map((s) => ({
      label: s.title,
      data: s.cashflow.map((c) => ({ x: c.year, y: c.cumulativeRub })),
      borderColor: colorOf(s.kind),
      backgroundColor: colorOf(s.kind),
      borderWidth: 2,
      borderDash: SERIES[s.kind].dash,
      pointStyle: SERIES[s.kind].point,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0,
    })),
    // Точки окупаемости: отдельные наборы без линии, скрыты из легенды.
    ...props.scenarios
      .filter((s) => s.kind !== 'baseline' && s.metrics.paybackYears.value !== null && s.metrics.paybackYears.value <= horizon.value)
      .map((s) => ({
        label: `Окупаемость: ${s.title}`,
        data: [{ x: s.metrics.paybackYears.value!, y: 0 }],
        borderColor: '#ffffff',
        backgroundColor: colorOf(s.kind),
        borderWidth: 2,
        pointStyle: 'circle' as const,
        pointRadius: 8,
        pointHoverRadius: 9,
        showLine: false,
      })),
  ],
}))

const options = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'nearest', intersect: false, axis: 'x' },
  scales: {
    x: {
      type: 'linear',
      min: 0,
      max: horizon.value,
      ticks: { stepSize: 1, color: textColor.value, callback: (v) => (Number(v) === 0 ? 'Старт' : `${v}-й год`) },
      grid: { display: false },
      border: { color: gridColor.value },
    },
    y: {
      ticks: { color: textColor.value, callback: (v) => millions(Number(v)) },
      // Нулевая линия — граница окупаемости, чуть темнее остальных.
      grid: { color: (ctx) => (ctx.tick.value === 0 ? inkColor.value : gridColor.value), lineWidth: (ctx) => (ctx.tick.value === 0 ? 1.5 : 1) },
      border: { display: false },
    },
  },
  plugins: {
    legend: {
      position: 'top',
      align: 'start',
      labels: { usePointStyle: true, color: inkColor.value, filter: (item) => !item.text.startsWith('Окупаемость:') },
    },
    tooltip: {
      callbacks: {
        title: (items) => {
          const x = items[0]?.parsed.x ?? 0
          return items[0]?.dataset.label?.startsWith('Окупаемость:') ? `Окупаемость через ${formatYears(x)}` : x === 0 ? 'Старт проекта' : `${x}-й год`
        },
        label: (item) =>
          item.dataset.label?.startsWith('Окупаемость:')
            ? (item.dataset.label ?? '')
            : `${item.dataset.label}: ${formatRub(item.parsed.y)}`,
      },
    },
  },
}))

const ariaLabel = computed(() =>
  `График накопленного денежного потока за ${formatYears(horizon.value)}. ` +
  props.scenarios
    .map((s) => `${s.title}: ${s.metrics.paybackYears.value !== null ? `окупается через ${formatYears(s.metrics.paybackYears.value)}` : 'без точки окупаемости'}`)
    .join('; '),
)

function cumulative(s: ScenarioResult, year: number): string {
  const row = s.cashflow.find((c) => c.year === year)
  return row ? formatRub(row.cumulativeRub) : '—'
}
</script>

<template>
  <figure class="cashflow">
    <div class="cashflow__canvas">
      <Line :data="data" :options="options" role="img" :aria-label="ariaLabel" />
    </div>
    <figcaption class="cashflow__caption">
      Большая точка на нулевой линии — момент окупаемости сценария.
      <el-button link type="primary" :aria-expanded="showTable" @click="showTable = !showTable">
        {{ showTable ? 'Скрыть таблицу' : 'Показать таблицей' }}
      </el-button>
    </figcaption>
    <div v-if="showTable" class="cashflow__table-wrap">
      <table class="cashflow__table">
        <thead>
          <tr>
            <th scope="col">Сценарий</th>
            <th v-for="y in years" :key="y" scope="col">{{ y === 0 ? 'Старт' : `${y}-й год` }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in scenarios" :key="s.id">
            <th scope="row">{{ s.title }}</th>
            <td v-for="y in years" :key="y">{{ cumulative(s, y) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.cashflow {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.cashflow__canvas {
  position: relative;
  height: 300px;
}

.cashflow__caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.cashflow__table-wrap {
  overflow-x: auto;
}

.cashflow__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.cashflow__table th,
.cashflow__table td {
  padding: 4px var(--space-2);
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.cashflow__table th[scope='row'],
.cashflow__table thead th:first-child {
  text-align: left;
}
</style>
