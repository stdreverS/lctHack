<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Robot } from '@/types/api'
import { buildComparison, NO_DATA, type SpecContext } from '@/utils/robotSpecs'

const props = defineProps<{
  robots: Robot[]
  ctx: SpecContext
}>()

const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ remove: [robot: Robot] }>()

const onlyDiffs = ref(false)

const groups = computed(() =>
  buildComparison(props.robots, props.ctx)
    .map((g) => ({ ...g, rows: onlyDiffs.value ? g.rows.filter((r) => r.differs) : g.rows }))
    .filter((g) => g.rows.length > 0),
)

const diffCount = computed(() =>
  buildComparison(props.robots, props.ctx).reduce((n, g) => n + g.rows.filter((r) => r.differs).length, 0),
)
</script>

<template>
  <el-dialog v-model="visible" title="Сравнение характеристик" width="min(1040px, 94vw)" top="6vh" append-to-body>
    <div class="compare__toolbar">
      <span class="compare__hint">
        <span class="compare__swatch" aria-hidden="true"></span>
        Выделены строки, где значения отличаются ({{ diffCount }})
      </span>
      <el-switch v-model="onlyDiffs" active-text="Только различия" />
    </div>

    <div class="compare__scroll">
      <table class="compare__table">
        <thead>
          <tr>
            <th scope="col" class="compare__label-col">Характеристика</th>
            <th v-for="robot in robots" :key="robot.id" scope="col">
              <div class="compare__robot">
                <RouterLink :to="{ name: 'robot', params: { id: robot.id } }" @click="visible = false">
                  {{ robot.name }}
                </RouterLink>
                <el-button
                  link
                  size="small"
                  :aria-label="`Убрать из сравнения: ${robot.name}`"
                  @click="emit('remove', robot)"
                >
                  Убрать
                </el-button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.key">
          <tr class="compare__group">
            <th :colspan="robots.length + 1" scope="colgroup">{{ group.label }}</th>
          </tr>
          <tr v-for="row in group.rows" :key="row.key" :class="{ 'compare__row--diff': row.differs }">
            <th scope="row" class="compare__label-col">{{ row.label }}</th>
            <td v-for="(value, i) in row.values" :key="i" :class="{ 'no-data': value === NO_DATA }">{{ value }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="groups.length === 0" class="compare__empty">Все характеристики выбранных роботов совпадают.</p>
    </div>

    <template #footer>
      <el-button type="primary" @click="visible = false">Закрыть</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.compare__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.compare__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
}

.compare__swatch {
  width: 14px;
  height: 14px;
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--color-primary);
}

.compare__scroll {
  max-height: 68vh;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.compare__table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.compare__table th,
.compare__table td {
  padding: 6px var(--space-3);
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.compare__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.compare__label-col {
  width: 240px;
  min-width: 200px;
  color: var(--color-text-secondary);
  font-weight: 400;
}

.compare__robot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 180px;
  font-weight: 600;
}

.compare__group th {
  padding-top: var(--space-3);
  background: var(--color-bg);
  font-weight: 600;
}

.compare__row--diff > * {
  background: var(--el-color-primary-light-9);
}

.compare__row--diff > th {
  box-shadow: inset 3px 0 0 var(--color-primary);
  color: var(--color-text);
}

.no-data {
  color: var(--color-text-secondary);
}

.compare__empty {
  padding: var(--space-4);
  color: var(--color-text-secondary);
  text-align: center;
}
</style>
