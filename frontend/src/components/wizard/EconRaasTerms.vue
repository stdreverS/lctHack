<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ScenarioInput } from '@/types/api'
import { formatNumber, formatRub } from '@/utils/format'

// Условия договора RaaS. Изменение значения (по выходу из поля или Enter) запускает пересчёт.
type Terms = NonNullable<ScenarioInput['raas']>

const props = defineProps<{ terms: Terms; catalogFee: number | null; disabled: boolean }>()
const emit = defineEmits<{ change: [terms: Terms] }>()

const form = reactive<Terms>({ ...props.terms })
watch(
  () => props.terms,
  (t) => Object.assign(form, t),
)

/** Разряды в денежных полях: «1 500 000». */
const money = {
  formatter: (v: number | string) => (v === '' || v === null ? '' : formatNumber(Number(v), 0)),
  parser: (v: string) => v.replace(/\D/g, ''),
}

function commit(key: keyof Terms, value: number | null | undefined) {
  if (typeof value !== 'number' || value === props.terms[key]) {
    form[key] = props.terms[key] // пустое поле — возвращаем прежнее значение
    return
  }
  emit('change', { ...props.terms, [key]: value })
}
</script>

<template>
  <fieldset class="terms" :disabled="disabled">
    <legend class="terms__title">Условия аренды (RaaS)</legend>
    <div class="terms__grid">
      <label class="terms__field">
        <span>Плата за робота, ₽/мес</span>
        <el-input-number
          v-model="form.monthlyFeePerRobotRub"
          :min="1000"
          :max="10_000_000"
          :step="5000"
          :value-on-clear="null"
          :controls="false"
          :formatter="money.formatter"
          :parser="money.parser"
          placeholder="Например, 115 000"
          @change="(v) => commit('monthlyFeePerRobotRub', v)"
        />
        <span class="form-hint">
          По каталогу: {{ catalogFee !== null ? formatRub(catalogFee) : 'нет данных' }}
        </span>
      </label>
      <label class="terms__field">
        <span>Срок договора, лет</span>
        <el-input-number
          v-model="form.contractYears"
          :min="1"
          :max="15"
          :precision="0"
          :value-on-clear="null"
          controls-position="right"
          placeholder="Например, 3"
          @change="(v) => commit('contractYears', v)"
        />
        <span class="form-hint">Обычно 3–5 лет</span>
      </label>
      <label class="terms__field">
        <span>Разовые затраты на внедрение, ₽</span>
        <el-input-number
          v-model="form.setupRub"
          :min="0"
          :max="1_000_000_000"
          :step="100000"
          :value-on-clear="null"
          :controls="false"
          :formatter="money.formatter"
          :parser="money.parser"
          placeholder="Например, 1 500 000"
          @change="(v) => commit('setupRub', v)"
        />
        <span class="form-hint">Интеграция и подготовка площадки</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.terms {
  min-width: 0;
  margin: 0;
  padding: var(--space-3) var(--space-4) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.terms__title {
  padding: 0 var(--space-1);
  font-weight: 600;
}

.terms__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3) var(--space-4);
}

.terms__field {
  display: grid;
  gap: 4px;
  font-size: 13px;
}

.terms__field .el-input-number {
  width: 100%;
}

.terms__field :deep(.el-input__inner) {
  text-align: left;
  font-variant-numeric: tabular-nums;
}
</style>
