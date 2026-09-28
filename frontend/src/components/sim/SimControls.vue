<script setup lang="ts">
import { computed } from 'vue'
import { Download, RefreshLeft, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { formatClock } from '@/utils/format'

// Управление проигрыванием: запуск, пауза, начало, скорость и модельное время.
const props = defineProps<{
  playing: boolean
  /** Во сколько раз модельное время быстрее реального. */
  speed: number
  timeSec: number
  durationSec: number
  /** Модель считается — управление заблокировано. */
  busy: boolean
}>()

const emit = defineEmits<{
  play: []
  pause: []
  restart: []
  'update:speed': [number]
  'update:timeSec': [number]
  save: []
}>()

const SPEEDS = [1, 10, 60, 300]

function toggle() {
  if (props.playing) emit('pause')
  else emit('play')
}

const progress = computed(() => Math.round(props.timeSec))
const total = computed(() => Math.max(1, Math.round(props.durationSec)))
</script>

<template>
  <div class="controls">
    <el-button
      type="primary"
      :icon="playing ? VideoPause : VideoPlay"
      :disabled="busy"
      @click="toggle"
    >
      {{ playing ? 'Пауза' : 'Запустить' }}
    </el-button>
    <el-button :icon="RefreshLeft" :disabled="busy" @click="emit('restart')">Сначала</el-button>

    <div class="controls__speed">
      <span id="sim-speed-label" class="controls__label">Скорость</span>
      <el-radio-group
        :model-value="speed"
        size="small"
        :disabled="busy"
        aria-labelledby="sim-speed-label"
        @update:model-value="(v) => emit('update:speed', Number(v))"
      >
        <el-radio-button v-for="s in SPEEDS" :key="s" :value="s">×{{ s }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="controls__time">
      <span class="controls__label">Время модели</span>
      <span class="controls__clock num" role="timer" aria-live="off">
        {{ formatClock(timeSec) }} / {{ formatClock(durationSec) }}
      </span>
    </div>

    <el-slider
      class="controls__seek"
      :model-value="progress"
      :min="0"
      :max="total"
      :step="1"
      :disabled="busy"
      :show-tooltip="false"
      aria-label="Перемотка модельного времени"
      @update:model-value="(v) => emit('update:timeSec', Array.isArray(v) ? (v[0] ?? 0) : v)"
    />

    <el-button :icon="Download" :disabled="busy" @click="emit('save')">Сохранить изображение</el-button>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.controls .el-button + .el-button {
  margin-left: 0;
}

.controls__speed,
.controls__time {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.controls__label {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.controls__clock {
  font-weight: 600;
}

.controls__seek {
  flex: 1 1 180px;
  min-width: 140px;
  margin: 0 var(--space-3);
}
</style>
