<script setup lang="ts">
import { computed } from 'vue'
import { RefreshLeft } from '@element-plus/icons-vue'
import { formatNumber, formatRub } from '@/utils/format'
import type { WhatIfKey, WhatIfValues } from '@/utils/whatif'

// Панель допущений шага «What-if»: слайдер + поле ввода, исходное значение и сброс.
// Пересчёт запускает только кнопка «Пересчитать» — движение слайдера расчёт не вызывает.
const props = defineProps<{
  values: WhatIfValues
  base: WhatIfValues
  /** Расчёт выполняется — поля заблокированы. */
  busy: boolean
  /** Производительность робота есть в каталоге (иначе показываем, что это допущение). */
  perfFromCatalog: boolean
}>()

// Значение отдаётся родителю по одному полю: так два изменения в одном такте
// (слайдер и поле ввода) не затирают друг друга.
const emit = defineEmits<{ update: [key: WhatIfKey, value: number]; calculate: []; resetAll: [] }>()

interface FieldDef {
  key: WhatIfKey
  label: string
  unit: string
  /** Деньги — с разделителями разрядов; доля — показывается в процентах. */
  kind: 'money' | 'count' | 'share'
  min: number
  max: number
  step: number
  hint?: string
}

/** Диапазон вокруг исходного значения, кратный шагу: слайдер всегда охватывает исходное. */
function around(base: number, step: number, low = 0.5, high = 2): [number, number] {
  const min = Math.max(step, Math.floor((base * low) / step) * step)
  const max = Math.ceil((base * high) / step) * step
  return [min, Math.max(max, min + step)]
}

const FIELDS = computed<FieldDef[]>(() => {
  const b = props.base
  const [staffMin, staffMax] = around(b.staffCostMonthRub, 5000)
  const [perfMin, perfMax] = around(b.perfOpsPerHour, 5)
  const [priceMin, priceMax] = around(b.unitPriceRub, 100_000)
  const [maintMin, maintMax] = around(b.maintenancePerYearRub, 20_000)
  return [
    { key: 'staffCostMonthRub', label: 'Стоимость сотрудника', unit: '₽/мес', kind: 'money', min: staffMin, max: staffMax, step: 5000, hint: 'Зарплата с налогами и взносами' },
    { key: 'shiftsPerDay', label: 'Смен в сутки', unit: 'смен', kind: 'count', min: 1, max: Math.max(4, b.shiftsPerDay), step: 1 },
    { key: 'hoursPerShift', label: 'Часов в смене', unit: 'ч', kind: 'count', min: Math.min(4, b.hoursPerShift), max: Math.max(12, b.hoursPerShift), step: 1 },
    { key: 'workDaysPerYear', label: 'Рабочих дней в году', unit: 'дн.', kind: 'count', min: Math.min(200, b.workDaysPerYear), max: Math.max(365, b.workDaysPerYear), step: 5 },
    { key: 'utilization', label: 'Загрузка робота', unit: '%', kind: 'share', min: 40, max: 100, step: 5, hint: 'Доля времени смены под полезной работой' },
    { key: 'horizonYears', label: 'Горизонт расчёта', unit: 'лет', kind: 'count', min: 5, max: 10, step: 1 },
    { key: 'perfOpsPerHour', label: 'Производительность робота', unit: 'опер./ч', kind: 'count', min: perfMin, max: perfMax, step: 5, hint: props.perfFromCatalog ? 'Из каталога робота' : 'В каталоге не указана — значение принято как допущение' },
    { key: 'unitPriceRub', label: 'Цена робота', unit: '₽', kind: 'money', min: priceMin, max: priceMax, step: 100_000, hint: 'Влияет на сценарий покупки' },
    { key: 'maintenancePerYearRub', label: 'Обслуживание робота в год', unit: '₽', kind: 'money', min: maintMin, max: maintMax, step: 20_000, hint: 'Влияет на сценарий покупки' },
  ]
})

/** Значение поля в единицах интерфейса: доля 0,75 показывается как 75 %. */
function shown(f: FieldDef, v: WhatIfValues): number {
  return f.kind === 'share' ? Math.round(v[f.key] * 100) : v[f.key]
}

function set(f: FieldDef, next: number | null | undefined) {
  if (typeof next !== 'number' || !Number.isFinite(next)) return
  const clamped = Math.min(f.max, Math.max(f.min, next))
  emit('update', f.key, f.kind === 'share' ? clamped / 100 : clamped)
}

function reset(f: FieldDef) {
  emit('update', f.key, props.base[f.key])
}

function text(f: FieldDef, v: number): string {
  const n = f.kind === 'share' ? Math.round(v * 100) : v
  return f.kind === 'money' ? formatRub(n) : `${formatNumber(n)} ${f.unit}`
}

const changed = computed(() => FIELDS.value.filter((f) => props.values[f.key] !== props.base[f.key]))
const money = {
  formatter: (v: number | string) => (v === '' || v === null ? '' : formatNumber(Number(v), 0)),
  parser: (v: string) => v.replace(/\D/g, ''),
}
</script>

<template>
  <section class="panel" aria-labelledby="whatif-panel-title">
    <header class="panel__bar">
      <h3 id="whatif-panel-title" class="panel__title">Допущения расчёта</h3>
      <span class="panel__changed" aria-live="polite">
        {{ changed.length ? `Изменено полей: ${changed.length}` : 'Значения исходные' }}
      </span>
      <el-button :disabled="!changed.length || busy" :icon="RefreshLeft" @click="emit('resetAll')">
        Сбросить всё
      </el-button>
      <el-button type="primary" :loading="busy" @click="emit('calculate')">Пересчитать</el-button>
    </header>

    <div class="panel__grid">
      <div v-for="f in FIELDS" :key="f.key" class="field">
        <div class="field__head">
          <span :id="`whatif-${f.key}`" class="field__label">{{ f.label }}, {{ f.unit }}</span>
          <el-button
            link
            type="primary"
            size="small"
            :disabled="values[f.key] === base[f.key] || busy"
            @click="reset(f)"
          >
            Сбросить
          </el-button>
        </div>
        <div class="field__controls">
          <el-slider
            :model-value="shown(f, values)"
            :min="f.min"
            :max="f.max"
            :step="f.step"
            :disabled="busy"
            :show-tooltip="false"
            :aria-labelledby="`whatif-${f.key}`"
            class="field__slider"
            @update:model-value="(v) => set(f, Array.isArray(v) ? v[0] : v)"
          />
          <el-input-number
            :model-value="shown(f, values)"
            :min="f.min"
            :max="f.max"
            :step="f.step"
            :disabled="busy"
            :controls="false"
            :formatter="f.kind === 'money' ? money.formatter : undefined"
            :parser="f.kind === 'money' ? money.parser : undefined"
            :aria-labelledby="`whatif-${f.key}`"
            class="field__input"
            @update:model-value="(v) => set(f, v)"
          />
        </div>
        <p class="field__foot">
          <span class="field__base">Исходно: {{ text(f, base[f.key]) }}</span>
          <span v-if="f.hint" class="field__hint">{{ f.hint }}</span>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.panel__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.panel__title {
  font-size: 16px;
  font-weight: 600;
}

.panel__changed {
  margin-right: auto;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.panel__bar .el-button + .el-button {
  margin-left: 0;
}

.panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4) var(--space-5);
}

.field__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.field__label {
  font-size: 13px;
  font-weight: 600;
}

.field__head .el-button {
  height: auto;
  padding: 0;
}

.field__controls {
  display: grid;
  grid-template-columns: 1fr 130px;
  align-items: center;
  gap: var(--space-4);
}

.field__slider {
  min-width: 0;
}

.field__input {
  width: 130px;
}

.field__input :deep(.el-input__inner) {
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.field__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.field__base {
  font-variant-numeric: tabular-nums;
}
</style>
