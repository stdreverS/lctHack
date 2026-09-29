<script setup lang="ts">
import { computed } from 'vue'
import type { CalcResult, ObjectType, Params, Robot, SimKpi } from '@/types/api'
import ReportSolutions from '@/components/report/ReportSolutions.vue'
import ReportEconomics from '@/components/report/ReportEconomics.vue'
import { formatDate, formatNumber } from '@/utils/format'
import { REPORT_LIMITATIONS, deltaLabel, paramGroups, sensitivityTables, simulationRows } from '@/utils/report'

// Документ отчёта: разделы по п. 3.7.2 ТЗ. Только отображение ответа сервера.
const props = defineProps<{
  result: CalcResult
  type: ObjectType
  params: Params
  processes: string[]
  robots: Robot[]
  objectTypeNames: Record<string, string>
  projectName: string | null
  simKpi: SimKpi | null
  simScenario: string | null
}>()

const groups = computed(() => paramGroups(props.type, props.params))
const processNames = computed(() => props.type.processes.filter((p) => props.processes.includes(p.code)).map((p) => p.name))
const sensitivity = computed(() => sensitivityTables(props.result.scenarios, props.result.sensitivity))
const sim = computed(() => simulationRows(props.simKpi, props.simScenario))
</script>

<template>
  <article class="report">
    <header class="report__head">
      <p class="report__kicker">Отчёт о предварительной оценке роботизации</p>
      <h1 class="report__title">{{ projectName ?? `${type.name}: демонстрационная оценка` }}</h1>
      <dl class="report__meta">
        <div><dt>Тип объекта</dt><dd>{{ type.name }}</dd></div>
        <div><dt>Дата расчёта</dt><dd>{{ formatDate(result.calculatedAt, true) }}</dd></div>
        <div><dt>Версия модели</dt><dd>{{ result.modelVersion }}</dd></div>
        <div><dt>Версия данных</dt><dd>{{ result.dataVersion }}</dd></div>
      </dl>
      <p class="report__disclaimer" role="note">{{ result.disclaimer }}</p>
    </header>

    <section class="report__section">
      <h2 class="report__h2">1. Объект и параметры</h2>
      <p><strong>Процессы для роботизации:</strong> {{ processNames.join(', ') || '—' }}</p>
      <table v-for="g in groups" :key="g.key" class="report-table report-table--params">
        <caption>{{ g.label }}</caption>
        <colgroup><col /><col /><col /></colgroup>
        <thead><tr><th>Параметр</th><th class="num">Значение</th><th>Источник значения</th></tr></thead>
        <tbody>
          <tr v-for="r in g.rows" :key="r.key">
            <td>{{ r.label }}</td>
            <td class="num">{{ r.value }}</td>
            <td>{{ r.source ?? 'Параметры объекта' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="report__section report__section--page">
      <h2 class="report__h2">2. Выбранные решения</h2>
      <ReportSolutions :result="result" :robots="robots" :object-type-names="objectTypeNames" />
    </section>

    <section class="report__section report__section--page">
      <h2 class="report__h2">3. Экономика сценариев</h2>
      <ReportEconomics :result="result" />
    </section>

    <section class="report__section report__section--page">
      <h2 class="report__h2">4. Чувствительность срока окупаемости</h2>
      <p>Как меняется срок окупаемости при отклонении параметра от расчётного значения (0 %).</p>
      <p v-if="!sensitivity.length">Сервер не вернул рядов чувствительности.</p>
      <table v-for="t in sensitivity" :key="t.scenarioId" class="report-table">
        <caption>{{ t.title }}</caption>
        <thead>
          <tr><th>Параметр</th><th v-for="d in t.deltas" :key="d" class="num">{{ d === 0 ? 'Расчёт' : deltaLabel(d) }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in t.rows" :key="r.param"><td>{{ r.label }}</td><td v-for="(c, i) in r.cells" :key="i" class="num">{{ c }}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="report__section">
      <h2 class="report__h2">5. Допущения и источники</h2>
      <table class="report-table">
        <thead><tr><th>Допущение</th><th>Значение</th><th>Источник</th><th>Статус</th></tr></thead>
        <tbody>
          <tr v-for="a in result.assumptionsUsed" :key="a.key">
            <td>{{ a.label }}</td>
            <td class="num">{{ typeof a.value === 'number' ? formatNumber(a.value) : a.value }}&nbsp;{{ a.unit }}</td>
            <td>{{ a.source }}</td>
            <td>{{ a.confirmed ? 'Подтверждено' : 'Допущение' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="report__section">
      <h2 class="report__h2">6. Проверка на 2D-симуляции</h2>
      <table v-if="sim" class="report-table">
        <tbody><tr v-for="r in sim" :key="r.label"><td>{{ r.label }}</td><td>{{ r.value }}</td></tr></tbody>
      </table>
      <p v-else>Для этого типа объекта схема пока не подготовлена — проверка на симуляции недоступна.</p>
    </section>

    <section class="report__section">
      <h2 class="report__h2">7. Ограничения оценки</h2>
      <ul class="report__list">
        <li v-for="l in REPORT_LIMITATIONS" :key="l">{{ l }}</li>
      </ul>
      <p class="report__disclaimer">{{ result.disclaimer }}</p>
    </section>
  </article>
</template>

<style scoped>
.report {
  display: grid;
  gap: var(--space-5);
  max-width: 1000px;
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.report__kicker {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.report__title {
  margin-top: var(--space-1);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
}

.report__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-5);
  margin-top: var(--space-3);
}

.report__meta dd {
  margin: 0;
}

.report__meta dt {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.report__disclaimer {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 8%, white);
}

.report__section {
  display: grid;
  gap: var(--space-3);
}

.report__h2 {
  font-size: 17px;
  font-weight: 600;
}

.report__list {
  padding-left: var(--space-5);
  list-style: disc;
}
</style>
