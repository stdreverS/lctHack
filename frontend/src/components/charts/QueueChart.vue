<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { formatNumber } from '@/utils/format'

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip)

// Очередь заявок по минутам прогона: растёт — парк не успевает за потоком.
const props = defineProps<{ queueByMinute: number[] }>()

const lineColor = ref('#2f5d7c')
const textColor = ref('#5b6b77')
const gridColor = ref('#d5dce1')

onMounted(() => {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  lineColor.value = read('--color-primary', lineColor.value)
  textColor.value = read('--color-text-secondary', textColor.value)
  gridColor.value = read('--color-border', gridColor.value)
})

const maxQueue = computed(() => Math.max(0, ...props.queueByMinute))

const data = computed<ChartData<'line', { x: number; y: number }[]>>(() => ({
  datasets: [
    {
      label: 'Заявок в очереди',
      data: props.queueByMinute.map((value, index) => ({ x: index + 1, y: value })),
      borderColor: lineColor.value,
      backgroundColor: lineColor.value,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
    },
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
      title: { display: true, text: 'Минута прогона', color: textColor.value },
      ticks: { color: textColor.value, precision: 0 },
      grid: { color: gridColor.value },
      border: { color: gridColor.value },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Заявок в очереди', color: textColor.value },
      ticks: { color: textColor.value, precision: 0 },
      grid: { color: gridColor.value },
      border: { display: false },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items) => `Минута ${items[0]?.parsed.x ?? ''}`,
        label: (item) => `В очереди: ${formatNumber(item.parsed.y, 0)}`,
      },
    },
  },
}))

const ariaLabel = computed(
  () =>
    `График очереди заявок по минутам. Наибольшая очередь ${maxQueue.value}, ` +
    `к концу прогона ${props.queueByMinute[props.queueByMinute.length - 1] ?? 0}.`,
)
</script>

<template>
  <figure class="queue">
    <div class="queue__canvas">
      <Line :data="data" :options="options" role="img" :aria-label="ariaLabel" />
    </div>
    <figcaption class="queue__caption">
      Растущая линия означает, что заявки поступают быстрее, чем парк успевает их выполнять.
    </figcaption>
  </figure>
</template>

<style scoped>
.queue {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.queue__canvas {
  position: relative;
  height: 220px;
}

.queue__caption {
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
