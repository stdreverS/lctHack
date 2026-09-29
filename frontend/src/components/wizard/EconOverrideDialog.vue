<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatNumber } from '@/utils/format'

// Ручная корректировка одного значения сценария (число роботов, цена робота).
const props = defineProps<{
  title: string
  label: string
  unit: string
  hint: string
  /** Текущее значение (ручное или расчётное) — стартовое в поле ввода. */
  current: number | null
  /** Значение ручное — можно вернуть расчётное. */
  overridden: boolean
  min: number
  max: number
  integer?: boolean
}>()

const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ apply: [value: number | null] }>()

const value = ref<number | null>(null)
/** Разряды в денежных полях: «4 200 000». */
const money = computed(() =>
  props.unit === '₽'
    ? {
        formatter: (v: number | string) => (v === '' || v === null ? '' : formatNumber(Number(v), 0)),
        parser: (v: string) => v.replace(/\D/g, ''),
      }
    : undefined,
)
const error = ref('')

// immediate: диалог создаётся уже открытым, поэтому поле заполняется сразу.
watch(
  visible,
  (open) => {
    if (!open) return
    value.value = props.current
    error.value = ''
  },
  { immediate: true },
)

function apply() {
  const v = value.value
  if (v === null) {
    error.value = `Введите значение от ${formatNumber(props.min)} до ${formatNumber(props.max)}`
    return
  }
  emit('apply', props.integer ? Math.round(v) : v)
  visible.value = false
}

function reset() {
  emit('apply', null)
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="min(440px, 94vw)" append-to-body>
    <el-form label-position="top" @submit.prevent="apply">
      <el-form-item :label="`${label}, ${unit}`" :error="error" for="override-input">
        <el-input-number
          id="override-input"
          v-model="value"
          :min="min"
          :max="max"
          :step="integer ? 1 : 10000"
          :precision="integer ? 0 : undefined"
          :value-on-clear="null"
          :formatter="money?.formatter"
          :parser="money?.parser"
          controls-position="right"
          class="override__input"
        />
        <p class="form-hint">{{ hint }}</p>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button v-if="overridden" link type="primary" class="override__reset" @click="reset">
        Вернуть расчётное значение
      </el-button>
      <el-button @click="visible = false">Отмена</el-button>
      <el-button type="primary" @click="apply">Применить и пересчитать</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.override__input {
  width: 100%;
}

.override__reset {
  float: left;
  margin-top: 8px;
}

:deep(.el-form-item__content) {
  flex-direction: column;
  align-items: stretch;
}
</style>
