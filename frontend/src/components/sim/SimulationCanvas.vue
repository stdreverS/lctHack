<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Layout } from '@/types/api'
import {
  SIM_PALETTE,
  drawScene,
  frameAt,
  resizeCanvas,
  type SimPalette,
  type Timeline,
} from '@/sim/renderer'
import { readPalette } from '@/sim/palette'
import { formatClock } from '@/utils/format'

// План объекта и роботы на нём. Рисуется чистым Canvas 2D (CLAUDE.md, раздел 2);
// модельное время ведёт этот компонент, наружу отдаётся через v-model:timeSec.
const props = defineProps<{
  layout: Layout
  timeline: Timeline
  /** Модельное время, с. */
  timeSec: number
  playing: boolean
  /** Во сколько раз модельное время быстрее реального. */
  speed: number
}>()

const emit = defineEmits<{ 'update:timeSec': [number]; finished: [] }>()

const wrap = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const palette = ref<SimPalette>(SIM_PALETTE)
const size = ref({ width: 0, height: 0 })

let frameRequest = 0
let lastFrameMs = 0
let observer: ResizeObserver | null = null

function draw() {
  const element = canvas.value
  const { width, height } = size.value
  if (!element || width < 1 || height < 1) return
  const ctx = element.getContext('2d')
  if (!ctx) return
  drawScene(ctx, {
    layout: props.layout,
    frames: frameAt(props.timeline, props.timeSec),
    timeSec: props.timeSec,
    widthPx: width,
    heightPx: height,
    dpr: window.devicePixelRatio,
    palette: palette.value,
    timeLabel: formatClock(props.timeSec),
  })
}

function applySize() {
  const box = wrap.value
  const element = canvas.value
  if (!box || !element) return
  const width = box.clientWidth
  // Высота холста — пропорция плана, но в разумных пределах для экрана 1366×768.
  const ratio = props.layout.heightM / Math.max(1, props.layout.widthM)
  const height = Math.max(240, Math.min(520, Math.round(width * ratio)))
  size.value = { width, height }
  resizeCanvas(element, width, height, window.devicePixelRatio)
  draw()
}

function tick(nowMs: number) {
  frameRequest = requestAnimationFrame(tick)
  if (!props.playing) {
    lastFrameMs = nowMs
    return
  }
  // Пропуск кадров (вкладка была неактивна) не должен перематывать модель рывком.
  const deltaSec = lastFrameMs ? Math.min(0.25, (nowMs - lastFrameMs) / 1000) : 0
  lastFrameMs = nowMs
  const next = props.timeSec + deltaSec * props.speed
  if (next >= props.timeline.durationSec) {
    emit('update:timeSec', props.timeline.durationSec)
    emit('finished')
    return
  }
  emit('update:timeSec', next)
}

function startLoop() {
  if (frameRequest) return
  lastFrameMs = 0
  frameRequest = requestAnimationFrame(tick)
}

function stopLoop() {
  if (!frameRequest) return
  cancelAnimationFrame(frameRequest)
  frameRequest = 0
}

/** PNG текущего кадра — для кнопки «Сохранить изображение». */
function toBlob(): Promise<Blob | null> {
  const element = canvas.value
  if (!element) return Promise.resolve(null)
  return new Promise((resolve) => element.toBlob((blob) => resolve(blob), 'image/png'))
}

defineExpose({ toBlob })

watch(() => [props.timeSec, props.timeline, props.layout], draw)
watch(
  () => props.playing,
  (playing) => (playing ? startLoop() : stopLoop()),
)

onMounted(() => {
  palette.value = readPalette()
  applySize()
  observer = new ResizeObserver(applySize)
  if (wrap.value) observer.observe(wrap.value)
  if (props.playing) startLoop()
})

onBeforeUnmount(() => {
  stopLoop()
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div ref="wrap" class="sim-canvas">
    <canvas
      ref="canvas"
      role="img"
      :aria-label="`План объекта: ${timeline.robotCount} роботов, модельное время ${formatClock(timeSec)}`"
    ></canvas>
  </div>
</template>

<style scoped>
.sim-canvas {
  min-width: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.sim-canvas canvas {
  display: block;
  max-width: 100%;
}
</style>
