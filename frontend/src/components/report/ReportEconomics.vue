<script setup lang="ts">
import type { CalcResult } from '@/types/api'
import ReportScenario from '@/components/report/ReportScenario.vue'
import { formatMetricValue, formatPayback } from '@/utils/economics'
import { EXPORT_METRICS } from '@/utils/export'

// Раздел отчёта «Экономика сценариев»: сводная таблица и подробности по каждому сценарию.
defineProps<{ result: CalcResult }>()
</script>

<template>
  <div class="economics report-block">
    <table class="report-table">
      <caption>Сравнение сценариев</caption>
      <thead>
        <tr><th>Показатель</th><th v-for="s in result.scenarios" :key="s.id" class="num">{{ s.title }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="key in EXPORT_METRICS" :key="key">
          <td>{{ result.scenarios[0]?.metrics[key].label }}</td>
          <td v-for="s in result.scenarios" :key="s.id" class="num">
            {{ key === 'paybackYears' ? formatPayback(s.metrics[key].value, s.kind) : formatMetricValue(s.metrics[key].value, s.metrics[key].unit) }}
          </td>
        </tr>
        <tr>
          <td>Вывод</td>
          <td v-for="s in result.scenarios" :key="s.id">{{ s.verdict.label }}</td>
        </tr>
      </tbody>
    </table>

    <ReportScenario v-for="s in result.scenarios" :key="s.id" :scenario="s" :assumptions="result.assumptionsUsed" />
  </div>
</template>

<style scoped>
.economics {
  display: grid;
  gap: var(--space-5);
}
</style>
