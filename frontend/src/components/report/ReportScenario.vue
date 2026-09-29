<script setup lang="ts">
import type { AssumptionRef, ScenarioResult } from '@/types/api'
import { formatMetricValue, formatPayback, metricInputs } from '@/utils/economics'
import { EXPORT_METRICS } from '@/utils/export'
import { formatRub } from '@/utils/format'

// Один сценарий в отчёте: оборудование, показатели с формулами, денежный поток, вывод.
defineProps<{ scenario: ScenarioResult; assumptions: AssumptionRef[] }>()
</script>

<template>
  <section class="scenario report-block">
    <h3 class="scenario__title">{{ scenario.title }}</h3>

    <table v-if="scenario.equipment.length" class="report-table">
      <caption>Состав оборудования и работ</caption>
      <thead><tr><th>Позиция</th><th class="num">Кол-во</th><th class="num">Цена за ед.</th><th class="num">Сумма</th></tr></thead>
      <tbody>
        <tr v-for="l in scenario.equipment" :key="l.item">
          <td>{{ l.item }}</td>
          <td class="num">{{ l.qty }}</td>
          <td class="num">{{ formatRub(l.unitPriceRub) }}</td>
          <td class="num">{{ formatRub(l.totalRub) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>Оборудование не закупается — процессы выполняет персонал.</p>

    <table class="report-table">
      <caption>Показатели и формулы</caption>
      <thead><tr><th>Показатель</th><th class="num">Значение</th><th>Формула и исходные данные</th></tr></thead>
      <tbody>
        <tr v-for="key in EXPORT_METRICS" :key="key">
          <td>
            {{ scenario.metrics[key].label }}
            <template v-if="scenario.metrics[key].overridden"> (изменено вручную)</template>
          </td>
          <td class="num">
            {{ key === 'paybackYears' ? formatPayback(scenario.metrics[key].value, scenario.kind) : formatMetricValue(scenario.metrics[key].value, scenario.metrics[key].unit) }}
          </td>
          <td>
            {{ scenario.metrics[key].formula }}
            <span v-for="i in metricInputs(scenario.metrics[key], assumptions)" :key="i.key" class="scenario__input">
              {{ i.label }}: {{ i.value }}
            </span>
            <span v-for="b in scenario.metrics[key].breakdown ?? []" :key="b.key" class="scenario__input">
              {{ b.label }}: {{ formatRub(b.value) }}<template v-if="b.source"> ({{ b.source }})</template>
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <table class="report-table">
      <caption>Денежный поток по годам</caption>
      <thead><tr><th>Год</th><th class="num">CAPEX</th><th class="num">OPEX</th><th class="num">Эффект</th><th class="num">Накопленный итог</th></tr></thead>
      <tbody>
        <tr v-for="y in scenario.cashflow" :key="y.year">
          <td class="num">{{ y.year }}</td>
          <td class="num">{{ formatRub(y.capexRub) }}</td>
          <td class="num">{{ formatRub(y.opexRub) }}</td>
          <td class="num">{{ formatRub(y.effectRub) }}</td>
          <td class="num">{{ formatRub(y.cumulativeRub) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="scenario__verdict">
      <p><strong>Вывод: {{ scenario.verdict.label }}.</strong> {{ scenario.verdict.interpretation }}</p>
      <p v-if="scenario.verdict.risks.length"><strong>Риски:</strong> {{ scenario.verdict.risks.join('; ') }}.</p>
    </div>
  </section>
</template>

<style scoped>
.scenario {
  display: grid;
  gap: var(--space-3);
}

.scenario__title {
  font-size: 15px;
  font-weight: 600;
}

.scenario__input {
  display: block;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.scenario__verdict {
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--color-primary);
}
</style>
