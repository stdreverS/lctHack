<script setup lang="ts">
import { computed } from 'vue'
import type { CalcResult, Robot } from '@/types/api'
import { usedRobots } from '@/utils/export'
import { formatNumber } from '@/utils/format'
import { STATUS_LABELS, checkValues } from '@/utils/recommendation'
import { ROBOT_SPEC_GROUPS } from '@/utils/robotSpecs'

// Раздел отчёта «Выбранные решения»: характеристики, источник, проверки подбора.
const props = defineProps<{ result: CalcResult; robots: Robot[]; objectTypeNames: Record<string, string> }>()

const CHECK_RESULT = { pass: 'пройдена', fail: 'не пройдена', unknown: 'нет данных' } as const

const items = computed(() =>
  usedRobots(props.result.scenarios, (id) => props.robots.find((r) => r.id === id)?.name ?? null).map((used) => ({
    ...used,
    robot: props.robots.find((r) => r.id === used.robotId) ?? null,
    rec: props.result.recommendation.find((r) => r.robotId === used.robotId) ?? null,
  })),
)
const ctx = computed(() => ({ objectTypeNames: props.objectTypeNames }))
</script>

<template>
  <div class="solutions report-block">
    <section v-for="item in items" :key="item.robotId" class="solutions__item report-block">
      <h3 class="solutions__title">{{ item.name }}</h3>
      <p>
        Сценарии: {{ item.scenarios.join(', ') }}.
        <template v-if="item.rec">
          Результат подбора: {{ STATUS_LABELS[item.rec.status] }}<template v-if="item.rec.score !== null">, балл {{ formatNumber(item.rec.score) }} из 100</template>.
        </template>
        <template v-else>Добавлен без автоматического подбора.</template>
      </p>

      <table v-if="item.robot" class="report-table">
        <caption>Характеристики и источник данных</caption>
        <tbody>
          <template v-for="g in ROBOT_SPEC_GROUPS" :key="g.key">
            <tr class="report-table__group"><th colspan="2">{{ g.label }}</th></tr>
            <tr v-for="row in g.rows" :key="row.key">
              <td>{{ row.label }}</td>
              <td>
                <a v-if="row.key === 'sourceUrl' && item.robot.sourceUrl" :href="item.robot.sourceUrl" class="report-link">{{ item.robot.sourceUrl }}</a>
                <template v-else>{{ row.value(item.robot, ctx) }}</template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <table v-if="item.rec?.checks.length" class="report-table">
        <caption>Проверки применимости</caption>
        <thead><tr><th>Проверка</th><th>Результат</th><th>Пояснение</th></tr></thead>
        <tbody>
          <tr v-for="c in item.rec.checks" :key="c.rule">
            <td>{{ c.label }}<template v-if="c.critical"> (критичная)</template></td>
            <td>{{ CHECK_RESULT[c.result] }}</td>
            <td>{{ c.message }}<template v-if="checkValues(c)"> — {{ checkValues(c) }}</template></td>
          </tr>
        </tbody>
      </table>

      <p v-if="item.rec?.missingData.length"><strong>Нет данных:</strong> {{ item.rec.missingData.join(', ') }}.</p>
    </section>
  </div>
</template>

<style scoped>
.solutions {
  display: grid;
  gap: var(--space-5);
}

.solutions__item {
  display: grid;
  gap: var(--space-3);
}

.solutions__title {
  font-size: 15px;
  font-weight: 600;
}
</style>
