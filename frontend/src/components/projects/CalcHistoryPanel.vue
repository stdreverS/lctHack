<script setup lang="ts">
import { ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { CalculationSummary } from '@/types/api'
import { getProjectCalculations } from '@/api/calculations'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import { formatDate, formatYears } from '@/utils/format'
import { paybackLevel } from '@/utils/projects'

// Боковая панель «История расчётов» проекта: список сохранённых расчётов, новые сверху.
const props = defineProps<{
  projectId: string
  /** Открытый сейчас расчёт — выделяется в списке. */
  activeId: string | null
  /** id последнего сохранённого расчёта: при его изменении список перечитывается. */
  refreshKey: string | null
}>()

const emit = defineEmits<{ open: [id: string]; 'go-export': [] }>()

const items = ref<CalculationSummary[]>([])
const loading = ref(false)
const error = ref<unknown>(null)
let seq = 0

async function load() {
  const current = ++seq
  loading.value = true
  error.value = null
  try {
    const list = await getProjectCalculations(props.projectId)
    if (current === seq) items.value = list
  } catch (e) {
    if (current === seq) error.value = e
  } finally {
    if (current === seq) loading.value = false
  }
}

watch(() => [props.projectId, props.refreshKey], load, { immediate: true })
</script>

<template>
  <aside class="history" aria-labelledby="history-title">
    <header class="history__head">
      <h2 id="history-title" class="history__title">История расчётов</h2>
      <el-button
        link
        :icon="Refresh"
        :loading="loading"
        aria-label="Обновить историю расчётов"
        title="Обновить"
        @click="load"
      />
    </header>

    <ErrorAlert v-if="error" :error="error" retry @retry="load" />

    <el-skeleton v-else-if="loading && !items.length" :rows="3" animated aria-busy="true" />

    <div v-else-if="!items.length" class="history__empty">
      <p>Сохранённых расчётов пока нет.</p>
      <p>Пройдите мастер и нажмите «Сохранить расчёт» на шаге «Экспорт».</p>
      <el-button size="small" @click="emit('go-export')">Перейти к экспорту</el-button>
    </div>

    <ol v-else class="history__list">
      <li v-for="c in items" :key="c.id">
        <button
          type="button"
          class="history__item"
          :class="{ 'is-active': c.id === activeId }"
          :aria-current="c.id === activeId ? 'true' : undefined"
          @click="emit('open', c.id)"
        >
          <span class="history__date num">{{ formatDate(c.createdAt, true) }}</span>
          <span class="history__meta">Модель {{ c.modelVersion }} · данные {{ c.dataVersion }}</span>
          <span class="history__payback">
            Лучшая окупаемость:
            <span :class="['payback', `payback--${paybackLevel(c.bestPaybackYears)}`]">
              {{ c.bestPaybackYears === null ? 'не окупается' : formatYears(c.bestPaybackYears) }}
            </span>
          </span>
        </button>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.history {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.history__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.history__title {
  font-size: 15px;
  font-weight: 600;
}

.history__empty {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.history__list {
  display: grid;
  gap: var(--space-2);
  max-height: 60vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.history__item {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
}

.history__item:hover {
  border-color: var(--color-primary);
}

.history__item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 1px;
}

.history__item.is-active {
  border-color: var(--color-primary);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.history__date {
  font-weight: 600;
}

.history__meta,
.history__payback {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.payback {
  font-weight: 600;
  white-space: nowrap;
}

.payback--good {
  color: var(--color-success);
}

.payback--moderate {
  color: color-mix(in srgb, var(--color-warning) 80%, black);
}

.payback--poor {
  color: var(--color-danger);
}

.payback--none {
  color: var(--color-text-secondary);
}
</style>
