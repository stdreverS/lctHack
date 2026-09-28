<script setup lang="ts">
import { computed, useId } from 'vue'
import { CircleCheckFilled, WarningFilled } from '@element-plus/icons-vue'
import type { CalcResult, SimKpi } from '@/types/api'
import EconKeyFigure from '@/components/wizard/EconKeyFigure.vue'
import ExportScenarioTable from '@/components/wizard/ExportScenarioTable.vue'
import { bestScenario } from '@/utils/economics'
import type { UsedRobot } from '@/utils/export'
import { formatDate, formatNumber, formatPercent } from '@/utils/format'

// Итоговая сводка расчёта: объект, роботы, три сценария, вывод, KPI симуляции.
// Используется на шаге «Экспорт» и при просмотре расчёта из истории проекта.
const props = defineProps<{
  objectName: string
  processNames: string[]
  robots: UsedRobot[]
  result: CalcResult
  simKpi: SimKpi | null
}>()

// Сводка может быть на странице дважды (мастер скрыт, открыт расчёт из истории) — id уникальны.
const uid = useId()
const best = computed(() => bestScenario(props.result.scenarios))

const simFigures = computed(() => {
  const kpi = props.simKpi
  if (!kpi) return []
  return [
    { key: 'achieved', label: 'Достигнуто от цели', value: formatPercent(kpi.achievedPercent) },
    {
      key: 'throughput',
      label: 'Производительность модели',
      value: `${formatNumber(kpi.throughputPerHour, 1)} из ${formatNumber(kpi.targetPerHour, 1)} опер./ч`,
    },
    { key: 'utilization', label: 'Средняя загрузка роботов', value: formatPercent(kpi.avgUtilization * 100) },
    { key: 'queue', label: 'Наибольшая очередь', value: `${formatNumber(kpi.maxQueue, 0)} заявок` },
  ]
})
</script>

<template>
  <div class="export-summary">
    <section class="export-summary__block" :aria-labelledby="`${uid}-object`">
      <h3 :id="`${uid}-object`" class="export-summary__title">Объект и роботы</h3>
      <dl class="export-summary__facts">
        <div>
          <dt>Тип объекта</dt>
          <dd>{{ objectName }}</dd>
        </div>
        <div>
          <dt>Процессы</dt>
          <dd>{{ processNames.length ? processNames.join(', ') : '—' }}</dd>
        </div>
        <div>
          <dt>Выбранные роботы</dt>
          <dd>
            <ul v-if="robots.length" class="export-summary__robots">
              <li v-for="r in robots" :key="r.robotId">
                <strong>{{ r.name }}</strong>
                <span class="export-summary__muted"> — {{ r.scenarios.join(', ') }}</span>
              </li>
            </ul>
            <template v-else>—</template>
          </dd>
        </div>
      </dl>
    </section>

    <EconKeyFigure :best="best" />

    <section class="export-summary__block" :aria-labelledby="`${uid}-scenarios`">
      <h3 :id="`${uid}-scenarios`" class="export-summary__title">Три сценария</h3>
      <ExportScenarioTable :scenarios="result.scenarios" />
      <p v-if="best" class="export-summary__conclusion">
        <strong>Вывод.</strong> {{ best.verdict.interpretation }}
      </p>
      <template v-if="best?.verdict.risks.length">
        <p class="export-summary__risks-title">Риски сценария «{{ best.title }}»</p>
        <ul class="export-summary__risks">
          <li v-for="r in best.verdict.risks" :key="r">{{ r }}</li>
        </ul>
      </template>
    </section>

    <section class="export-summary__block" :aria-labelledby="`${uid}-sim`">
      <h3 :id="`${uid}-sim`" class="export-summary__title">2D-симуляция</h3>
      <template v-if="simKpi">
        <p class="export-summary__sim-verdict" :class="simKpi.confirmsCalculation ? 'is-ok' : 'is-fail'">
          <el-icon :size="16" aria-hidden="true">
            <component :is="simKpi.confirmsCalculation ? CircleCheckFilled : WarningFilled" />
          </el-icon>
          {{ simKpi.confirmsCalculation ? 'Симуляция подтверждает расчёт' : 'Симуляция не подтверждает расчёт' }}
        </p>
        <dl class="export-summary__kpi">
          <div v-for="f in simFigures" :key="f.key">
            <dt>{{ f.label }}</dt>
            <dd class="num">{{ f.value }}</dd>
          </div>
        </dl>
        <p class="export-summary__muted">Узкое место: {{ simKpi.bottleneck }}</p>
      </template>
      <slot v-else name="sim-empty">
        <p class="export-summary__muted">Симуляция для этого расчёта не проводилась.</p>
      </slot>
    </section>

    <p class="export-summary__meta">
      Расчёт от {{ formatDate(result.calculatedAt, true) }}, модель {{ result.modelVersion }},
      данные {{ result.dataVersion }}. {{ result.disclaimer }}
    </p>
  </div>
</template>

<style scoped>
.export-summary {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.export-summary__block {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.export-summary__title {
  font-size: 16px;
  font-weight: 600;
}

.export-summary__facts,
.export-summary__kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.export-summary__facts dt,
.export-summary__kpi dt {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.export-summary__facts dd,
.export-summary__kpi dd {
  margin: 0;
}

.export-summary__kpi dd {
  font-size: 16px;
  font-weight: 600;
}

.export-summary__robots {
  margin: 0;
  padding: 0;
  list-style: none;
}

.export-summary__muted,
.export-summary__meta {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.export-summary__risks-title {
  font-size: 13px;
  font-weight: 600;
}

.export-summary__risks {
  margin: 0;
  padding-left: var(--space-4);
  font-size: 13px;
  list-style: disc;
}

.export-summary__sim-verdict {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}

.export-summary__sim-verdict.is-ok .el-icon {
  color: var(--color-success);
}

.export-summary__sim-verdict.is-fail .el-icon {
  color: var(--color-warning);
}
</style>
