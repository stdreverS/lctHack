<script setup lang="ts">
import type { Robot } from '@/types/api'
import { formatRub } from '@/utils/format'

// Выбор робота для одного сценария (покупка или RaaS) среди роботов, отобранных к сравнению.
export interface PickerOption {
  robot: Robot
  manual: boolean
  /** Причина недоступности; пустая строка — робота можно выбрать. */
  disabledReason: string
}

const props = defineProps<{
  kind: 'purchase' | 'raas'
  title: string
  description: string
  options: PickerOption[]
  error: string
}>()

const model = defineModel<string | null>({ required: true })

function price(robot: Robot): string {
  if (props.kind === 'purchase') return formatRub(robot.price)
  return robot.raasMonthlyPrice == null ? '' : `${formatRub(robot.raasMonthlyPrice)} в месяц`
}
</script>

<template>
  <fieldset class="picker" :class="{ 'picker--error': error }">
    <legend class="picker__title">{{ title }}</legend>
    <p class="picker__text">{{ description }}</p>
    <el-radio-group
      :model-value="model ?? undefined"
      class="picker__list"
      :aria-label="title"
      @update:model-value="(v) => (model = typeof v === 'string' ? v : null)"
    >
      <el-radio
        v-for="o in options"
        :key="o.robot.id"
        :value="o.robot.id"
        :disabled="!!o.disabledReason"
        border
        class="picker__option"
      >
        <span class="picker__name">
          {{ o.robot.name }}
          <span v-if="o.manual" class="picker__manual">добавлен вручную</span>
        </span>
        <span v-if="o.disabledReason" class="picker__reason">{{ o.disabledReason }}</span>
        <span v-else class="picker__price num">{{ price(o.robot) }}</span>
      </el-radio>
    </el-radio-group>
    <p v-if="error" class="picker__error" role="alert">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
.picker {
  min-width: 0;
  margin: 0;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.picker--error {
  border-color: var(--color-danger);
}

.picker__title {
  float: left;
  width: 100%;
  padding: 0;
  font-size: 16px;
  font-weight: 600;
}

.picker__text {
  clear: both;
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.picker__list {
  display: grid;
  gap: var(--space-2);
}

.picker__option {
  height: auto;
  margin-right: 0;
  padding: var(--space-2) var(--space-3);
  align-items: flex-start;
  white-space: normal;
}

.picker__option :deep(.el-radio__input) {
  margin-top: 3px;
}

.picker__option :deep(.el-radio__label) {
  display: grid;
  gap: 2px;
  line-height: 1.4;
}

.picker__name {
  font-weight: 600;
}

.picker__manual {
  margin-left: var(--space-1);
  padding: 0 var(--space-1);
  font-size: 11px;
  font-weight: 400;
  border: 1px dashed var(--color-danger);
  border-radius: 2px;
}

.picker__price,
.picker__reason {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.picker__error {
  margin-top: var(--space-2);
  color: var(--color-danger);
  font-size: 13px;
}
</style>
