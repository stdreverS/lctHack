<script setup lang="ts">
import { computed } from 'vue'
import type { RecommendationItem } from '@/types/api'
import StatusTag from '@/components/common/StatusTag.vue'
import CheckList from '@/components/common/CheckList.vue'
import ScoreBreakdown from '@/components/common/ScoreBreakdown.vue'
import { formatNumber } from '@/utils/format'

// Карточка робота в результатах подбора.
const props = defineProps<{
  item: RecommendationItem
  /** Название типа решения из каталога; если нет — код. */
  typeName: string
  selected: boolean
  manual: boolean
  /** Выбрано уже максимум роботов — добавить этого нельзя. */
  limitReached: boolean
}>()

const emit = defineEmits<{ toggle: [selected: boolean] }>()

const headingId = computed(() => `rec-${props.item.robotId}`)
const disabled = computed(() => !props.selected && props.limitReached)
</script>

<template>
  <article class="rec-card" :class="{ 'rec-card--selected': selected }" :aria-labelledby="headingId">
    <header class="rec-card__head">
      <div class="rec-card__title">
        <h4 :id="headingId" class="rec-card__name">
          <RouterLink :to="{ name: 'robot', params: { id: item.robotId } }" target="_blank">{{ item.name }}</RouterLink>
        </h4>
        <p class="rec-card__type">{{ typeName }}</p>
      </div>
      <div class="rec-card__badges">
        <span v-if="manual" class="rec-card__manual">Добавлен вручную</span>
        <StatusTag :status="item.status" />
        <span v-if="item.score !== null" class="rec-card__score num" :aria-label="`Балл ${formatNumber(item.score, 1)} из 100`">
          {{ formatNumber(item.score, 1) }}<small> / 100</small>
        </span>
      </div>
      <el-tooltip :disabled="!disabled" content="Для сравнения можно выбрать не более трёх роботов" placement="top">
        <span>
          <el-checkbox
            :model-value="selected"
            :disabled="disabled"
            border
            class="rec-card__pick"
            @update:model-value="(v) => emit('toggle', v === true)"
          >
            {{ selected ? 'В сравнении' : 'Сравнить' }}
          </el-checkbox>
        </span>
      </el-tooltip>
    </header>

    <div class="rec-card__body">
      <section class="rec-card__section">
        <h5 class="rec-card__subtitle">Проверки</h5>
        <CheckList :checks="item.checks" />
      </section>
      <section class="rec-card__section">
        <h5 class="rec-card__subtitle">Из чего сложился балл</h5>
        <ScoreBreakdown v-if="item.scoreBreakdown.length" :factors="item.scoreBreakdown" />
        <p v-else class="rec-card__muted">
          Балл не рассчитывается: робот не прошёл критическую проверку.
        </p>
      </section>
    </div>

    <p v-if="item.missingData.length" class="rec-card__missing">
      Нет данных: {{ item.missingData.join(', ') }}
    </p>
  </article>
</template>

<style scoped>
.rec-card {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.rec-card--selected {
  border-color: var(--color-primary);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.rec-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3);
}

.rec-card__title {
  flex: 1 1 240px;
  min-width: 0;
}

.rec-card__name {
  font-size: 16px;
  font-weight: 600;
}

.rec-card__type {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.rec-card__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.rec-card__manual {
  padding: 0 var(--space-2);
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text);
  border: 1px dashed var(--color-danger);
  border-radius: var(--radius);
}

.rec-card__score {
  font-size: 18px;
  font-weight: 600;
}

.rec-card__score small {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
}

.rec-card__pick {
  margin-right: 0;
}

.rec-card__body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-3) var(--space-5);
  margin-top: var(--space-3);
}

.rec-card__subtitle {
  margin: 0 0 var(--space-2);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rec-card__muted {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.rec-card__missing {
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 13px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
