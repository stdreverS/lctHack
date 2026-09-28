<script setup lang="ts">
import { computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import type { ParamField, ParamValue } from '@/types/api'
import SourceBadge from '@/components/common/SourceBadge.vue'
import { formatNumber } from '@/utils/format'

// Одно поле DynamicForm: подпись с единицей, подсказка, пример, значение по умолчанию с источником.
const props = defineProps<{
  field: ParamField
  value: ParamValue | undefined
  /** Текст ошибки; пустая строка — ошибки нет. */
  error: string
  inputId: string
}>()

const emit = defineEmits<{ update: [value: ParamValue]; blur: [] }>()

const label = computed(() => (props.field.unit ? `${props.field.label}, ${props.field.unit}` : props.field.label))

const placeholder = computed(() => {
  const ex = props.field.example
  if (props.field.type === 'enum') return 'Выберите из списка'
  if (ex === null || ex === undefined || typeof ex === 'boolean') return ''
  return `Например, ${typeof ex === 'number' ? formatNumber(ex) : ex}`
})

const defaultText = computed(() => {
  const d = props.field.default
  if (d === null || d === undefined) return ''
  if (typeof d === 'boolean') return d ? 'да' : 'нет'
  if (typeof d === 'number') return props.field.unit ? `${formatNumber(d)} ${props.field.unit}` : formatNumber(d)
  return props.field.options?.find((o) => o.value === d)?.label ?? d
})

const isDefault = computed(() => props.value === props.field.default)
const numberValue = computed(() => (typeof props.value === 'number' ? props.value : null))
const textValue = computed(() => (typeof props.value === 'string' ? props.value : ''))

function onNumber(v: number | null | undefined) {
  emit('update', typeof v === 'number' ? v : null)
}

function onText(v: string) {
  emit('update', v === '' ? null : v)
}
</script>

<template>
  <el-form-item :error="error" :required="field.required" :for="inputId" class="param">
    <template #label>
      <span class="param__label">
        {{ label }}
        <el-tooltip v-if="field.hint" :content="field.hint" placement="top" :show-after="200">
          <span class="param__hint" tabindex="0" role="img" :aria-label="`Подсказка: ${field.hint}`">
            <el-icon aria-hidden="true"><InfoFilled /></el-icon>
          </span>
        </el-tooltip>
      </span>
    </template>

    <el-input-number
      v-if="field.type === 'number' || field.type === 'integer'"
      :id="inputId"
      :model-value="numberValue"
      :controls="false"
      :value-on-clear="null"
      :placeholder="placeholder"
      class="param__number"
      @update:model-value="onNumber"
      @blur="emit('blur')"
    />
    <el-select
      v-else-if="field.type === 'enum'"
      :id="inputId"
      :model-value="textValue || null"
      :placeholder="placeholder"
      :clearable="!field.required"
      class="param__control"
      @update:model-value="(v: string | null) => emit('update', v || null)"
      @blur="emit('blur')"
    >
      <el-option v-for="o in field.options" :key="o.value" :value="o.value" :label="o.label" />
    </el-select>
    <el-radio-group
      v-else-if="field.type === 'boolean'"
      :id="inputId"
      :model-value="typeof value === 'boolean' ? value : undefined"
      :aria-label="field.label"
      @update:model-value="(v) => emit('update', v === true)"
    >
      <el-radio :value="true">Да</el-radio>
      <el-radio :value="false">Нет</el-radio>
    </el-radio-group>
    <el-input
      v-else
      :id="inputId"
      :model-value="textValue"
      :placeholder="placeholder"
      class="param__control"
      @update:model-value="onText"
      @blur="emit('blur')"
    />

    <div v-if="field.defaultSource && defaultText" class="form-hint param__default">
      <span>По умолчанию: {{ defaultText }}</span>
      <SourceBadge :confirmed="field.defaultSource.confirmed" :source="field.defaultSource.source" />
      <el-button v-if="!isDefault" link type="primary" size="small" @click="emit('update', field.default ?? null)">
        Подставить
      </el-button>
    </div>
  </el-form-item>
</template>

<style scoped>
/* Поле занимает две строки сетки DynamicForm (подпись и ввод) через subgrid: если подпись
   соседа переносится на несколько строк, поля ввода в ряду всё равно стоят на одном уровне. */
.param {
  display: grid;
  grid-row: span 2;
  grid-template-rows: subgrid;
}

.param > :deep(.el-form-item__label),
.param > :deep(.el-form-item__label-wrap) {
  align-self: end;
}

.param :deep(.el-form-item__content) {
  flex-direction: column;
  align-items: stretch;
}

.param__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.param__hint {
  display: inline-flex;
  color: var(--color-text-secondary);
  cursor: help;
  border-radius: 50%;
}

.param__number,
.param__control {
  width: 100%;
}

.param__number :deep(.el-input__inner) {
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.param__default {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.param__default .el-button {
  height: auto;
  padding: 0;
}
</style>
