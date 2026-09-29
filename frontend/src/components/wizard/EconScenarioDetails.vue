<script setup lang="ts">
import { computed } from 'vue'
import { EditPen } from '@element-plus/icons-vue'
import type { AssumptionRef, MetricKey, ScenarioResult } from '@/types/api'
import MetricCard from '@/components/common/MetricCard.vue'
import { formatPayback } from '@/utils/economics'
import { formatNumber, formatRub } from '@/utils/format'

// Подробности сценария: все метрики (раскрываются) и состав оборудования.
const props = defineProps<{
  scenario: ScenarioResult
  assumptions: AssumptionRef[]
  /** Цена робота изменена вручную (overrides.unitPriceRub). */
  priceOverridden: boolean
}>()

const emit = defineEmits<{ edit: [field: 'robotCount' | 'unitPriceRub'] }>()

const ORDER: MetricKey[] = [
  'robotCount', 'capexRub', 'annualEffectRub', 'paybackYears',
  'roiPercent', 'opexAnnualRub', 'opexDeltaRub', 'tcoRub',
]

const hasRobots = computed(() => props.scenario.kind !== 'baseline')
const metrics = computed(() => ORDER.map((key) => ({ key, metric: props.scenario.metrics[key] })))
/** Строка робота в спецификации — первая (так её формирует сервер для сценария покупки). */
const robotLineIndex = computed(() => (props.scenario.kind === 'purchase' && props.scenario.equipment.length ? 0 : -1))
</script>

<template>
  <div class="details">
    <div class="details__metrics">
      <MetricCard
        v-for="{ key, metric } in metrics"
        :key="key"
        :metric="metric"
        :assumptions="assumptions"
        :value-text="key === 'paybackYears' ? formatPayback(metric.value, scenario.kind) : undefined"
      >
        <template v-if="hasRobots && key === 'robotCount'" #actions>
          <el-button link type="primary" size="small" :icon="EditPen" @click="emit('edit', 'robotCount')">
            Изменить
          </el-button>
        </template>
        <template v-else-if="scenario.kind === 'purchase' && key === 'capexRub'" #actions>
          <el-button link type="primary" size="small" :icon="EditPen" @click="emit('edit', 'unitPriceRub')">
            Изменить цену робота
          </el-button>
        </template>
      </MetricCard>
    </div>

    <section v-if="hasRobots" class="details__equipment" aria-label="Состав оборудования и работ">
      <h4 class="details__title">Состав оборудования и работ</h4>
      <div class="details__table-wrap">
        <table class="details__table">
          <thead>
            <tr>
              <th scope="col">Позиция</th>
              <th scope="col" class="details__num">Кол-во</th>
              <th scope="col" class="details__num">Цена за ед.</th>
              <th scope="col" class="details__num">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, i) in scenario.equipment" :key="`${i}-${line.item}`">
              <th scope="row">{{ line.item }}</th>
              <td class="details__num">{{ formatNumber(line.qty) }}</td>
              <td class="details__num">
                {{ formatRub(line.unitPriceRub) }}
                <template v-if="i === robotLineIndex">
                  <span v-if="priceOverridden" class="details__manual">изменено вручную</span>
                  <el-button link type="primary" size="small" @click="emit('edit', 'unitPriceRub')">Изменить</el-button>
                </template>
              </td>
              <td class="details__num">{{ formatRub(line.totalRub) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colspan="3">Итого капитальные затраты</th>
              <td class="details__num">{{ formatRub(scenario.metrics.capexRub.value) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.details {
  display: grid;
  gap: var(--space-4);
}

.details__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.details__title {
  margin-bottom: var(--space-2);
  font-size: 14px;
  font-weight: 600;
}

.details__table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.details__table {
  width: 100%;
  border-collapse: collapse;
}

.details__table th,
.details__table td {
  padding: 6px var(--space-3);
  text-align: left;
  font-weight: 400;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.details__table thead th {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.details__table tfoot th,
.details__table tfoot td {
  font-weight: 600;
  border-bottom: 0;
}

.details__num {
  text-align: right !important;
  white-space: nowrap;
}

.details__manual {
  margin: 0 var(--space-1);
  padding: 0 var(--space-1);
  font-size: 12px;
  background: var(--el-color-warning-light-9);
  border-radius: 2px;
}
</style>
