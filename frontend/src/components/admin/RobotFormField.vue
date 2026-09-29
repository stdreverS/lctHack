<script setup lang="ts">
import { computed } from 'vue'
import type { RobotFieldDef, RobotForm } from '@/utils/robotForm'

type Value = RobotForm[keyof RobotForm]
interface Option {
  value: string
  label: string
}

// Одно поле формы робота: подпись с единицей, пример в placeholder, подсказка, ошибка.
const props = defineProps<{
  def: RobotFieldDef
  value: Value
  /** Текст ошибки; пустая строка — ошибки нет. */
  error: string
  inputId: string
  objectTypeOptions: Option[]
  solutionTypeOptions: Option[]
}>()

const emit = defineEmits<{ update: [value: Value]; blur: [] }>()

const label = computed(() => (props.def.unit ? `${props.def.label}, ${props.def.unit}` : props.def.label))
const placeholder = computed(() => (props.def.example ? `Например, ${props.def.example}` : ''))
const text = computed(() => (typeof props.value === 'string' ? props.value : ''))
const number = computed(() => (typeof props.value === 'number' ? props.value : null))
const list = computed(() => (Array.isArray(props.value) ? props.value : []))

function isFuture(date: Date): boolean {
  return date.getTime() > Date.now()
}
</script>

<template>
  <el-form-item :label="def.kind === 'boolean' ? undefined : label" :for="inputId" :error="error" :required="def.required">
    <el-input
      v-if="def.kind === 'text' || def.kind === 'url'"
      :id="inputId"
      :model-value="text"
      :maxlength="def.maxLength"
      :type="def.kind === 'url' ? 'url' : 'text'"
      :placeholder="placeholder"
      @update:model-value="(v: string) => emit('update', v)"
      @blur="emit('blur')"
    />

    <el-input-number
      v-else-if="def.kind === 'number' || def.kind === 'integer'"
      :id="inputId"
      :model-value="number"
      :controls="false"
      :value-on-clear="null"
      :placeholder="placeholder"
      class="robot-field__full"
      @update:model-value="(v: number | null | undefined) => emit('update', typeof v === 'number' ? v : null)"
      @blur="emit('blur')"
    />

    <el-select
      v-else-if="def.kind === 'solutionType'"
      :id="inputId"
      :model-value="text || null"
      filterable
      allow-create
      default-first-option
      :placeholder="placeholder"
      class="robot-field__full"
      @update:model-value="(v: string | null) => emit('update', (v ?? '').trim())"
      @blur="emit('blur')"
    >
      <el-option v-for="o in solutionTypeOptions" :key="o.value" :value="o.value" :label="`${o.value} — ${o.label}`" />
    </el-select>

    <el-select
      v-else-if="def.kind === 'objectTypes'"
      :id="inputId"
      :model-value="list"
      multiple
      :placeholder="def.example"
      class="robot-field__full"
      @update:model-value="(v: string[]) => emit('update', v)"
      @blur="emit('blur')"
    >
      <el-option v-for="o in objectTypeOptions" :key="o.value" :value="o.value" :label="o.label" />
    </el-select>

    <el-date-picker
      v-else-if="def.kind === 'date'"
      :id="inputId"
      :model-value="text || null"
      type="date"
      value-format="YYYY-MM-DD"
      format="DD.MM.YYYY"
      :placeholder="def.example"
      :disabled-date="isFuture"
      class="robot-field__full"
      @update:model-value="(v: string | null) => emit('update', v ?? '')"
      @blur="emit('blur')"
    />

    <el-checkbox
      v-else-if="def.kind === 'boolean'"
      :id="inputId"
      :model-value="value === true"
      class="robot-field__checkbox"
      @update:model-value="(v) => emit('update', v === true)"
    >
      {{ def.label }}
    </el-checkbox>

    <div class="form-hint">{{ def.hint }}</div>
  </el-form-item>
</template>

<style scoped>
.robot-field__full {
  width: 100%;
}

:deep(.el-form-item__content) {
  flex-direction: column;
  align-items: stretch;
}

.robot-field__checkbox {
  height: auto;
  margin-right: 0;
  white-space: normal;
}

:deep(.el-input-number .el-input__inner) {
  text-align: left;
}
</style>
