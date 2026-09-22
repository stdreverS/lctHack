<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { getObjectTypes } from '@/api/objectTypes'
import { getRobots } from '@/api/robots'
import type { ObjectType, Robot } from '@/types/api'
import CatalogFilters from '@/components/catalog/CatalogFilters.vue'
import RobotTable from '@/components/catalog/RobotTable.vue'
import RobotCompareDialog from '@/components/catalog/RobotCompareDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import {
  filtersFromQuery,
  filtersToQuery,
  filtersToRequest,
  hasActiveFilters,
  type CatalogFilters as Filters,
} from '@/utils/catalogQuery'
import type { SpecContext } from '@/utils/robotSpecs'

const MAX_COMPARE = 3

const route = useRoute()
const router = useRouter()

const filters = computed(() => filtersFromQuery(route.query))

// ---------- Справочники для фильтров ----------
const objectTypes = ref<ObjectType[]>([])
// Типы решений в API отдельным справочником нет — собираем из полного каталога.
const solutionTypeOptions = ref<{ value: string; label: string }[]>([])
const optionsLoaded = ref(false)

const objectTypeOptions = computed(() => objectTypes.value.map((t) => ({ value: t.code, label: t.name })))
const specCtx = computed<SpecContext>(() => ({
  objectTypeNames: Object.fromEntries(objectTypes.value.map((t) => [t.code, t.name])),
}))

async function loadOptions() {
  const [types, all] = await Promise.all([getObjectTypes(), getRobots()])
  objectTypes.value = types
  const byCode = new Map(all.map((r) => [r.solutionType, r.solutionTypeName]))
  solutionTypeOptions.value = [...byCode]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  optionsLoaded.value = true
}

// ---------- Список роботов ----------
const robots = ref<Robot[] | null>(null)
const loading = ref(false)
const error = ref<unknown>(null)
let requestSeq = 0

async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  try {
    const [list] = await Promise.all([
      getRobots(filtersToRequest(filters.value)),
      optionsLoaded.value ? Promise.resolve() : loadOptions(),
    ])
    if (seq === requestSeq) robots.value = list
  } catch (e) {
    if (seq === requestSeq) error.value = e
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

// При уходе в карточку робота route.query успевает смениться до размонтирования — такой запрос не нужен.
watch(
  () => (route.name === 'catalog' ? JSON.stringify(filters.value) : null),
  (key) => {
    if (key !== null) void load()
  },
  { immediate: true },
)

function applyFilters(next: Filters) {
  void router.replace({ query: filtersToQuery(next) })
}

function resetFilters() {
  applyFilters({ q: '', objectType: '', solutionType: '', sort: filters.value.sort })
}

// ---------- Сравнение ----------
// Храним сами объекты: выбор сохраняется, даже если робот скрыт текущими фильтрами.
const selected = ref<Robot[]>([])
const selectedIds = computed(() => selected.value.map((r) => r.id))
const compareOpen = ref(false)

function toggle(robot: Robot) {
  if (selectedIds.value.includes(robot.id)) {
    selected.value = selected.value.filter((r) => r.id !== robot.id)
  } else if (selected.value.length < MAX_COMPARE) {
    selected.value = [...selected.value, robot]
  }
  if (selected.value.length < 2) compareOpen.value = false
}
</script>

<template>
  <section class="catalog">
    <h1 class="page__title">Каталог роботов</h1>

    <CatalogFilters
      :filters="filters"
      :object-type-options="objectTypeOptions"
      :solution-type-options="solutionTypeOptions"
      @change="applyFilters"
    />

    <div class="catalog__bar" aria-live="polite">
      <span v-if="robots" class="catalog__count">Найдено: {{ robots.length }}</span>
      <div class="catalog__compare">
        <span class="catalog__selected">
          <template v-if="selected.length">Выбрано для сравнения: {{ selected.length }} из {{ MAX_COMPARE }}</template>
          <template v-else>Отметьте 2–3 робота, чтобы сравнить характеристики</template>
        </span>
        <el-tag
          v-for="robot in selected"
          :key="robot.id"
          closable
          disable-transitions
          type="info"
          @close="toggle(robot)"
        >
          {{ robot.name }}
        </el-tag>
        <el-button v-if="selected.length" link @click="selected = []">Очистить</el-button>
        <el-button type="primary" :disabled="selected.length < 2" @click="compareOpen = true">
          Сравнить{{ selected.length >= 2 ? ` (${selected.length})` : '' }}
        </el-button>
      </div>
    </div>

    <ErrorAlert v-if="error" :error="error" retry @retry="load" />

    <el-skeleton v-else-if="robots === null" :rows="8" animated class="catalog__skeleton" />

    <EmptyState
      v-else-if="robots.length === 0"
      title="Роботы не найдены"
      :description="
        hasActiveFilters(filters)
          ? 'По выбранным фильтрам в каталоге ничего нет. Измените условия поиска или сбросьте фильтры.'
          : 'Каталог пока пуст. Администратор может добавить роботов в разделе «Управление каталогом».'
      "
      :icon="Search"
    >
      <el-button v-if="hasActiveFilters(filters)" type="primary" @click="resetFilters">Сбросить фильтры</el-button>
    </EmptyState>

    <div v-else v-loading="loading" element-loading-text="Обновляем список…">
      <RobotTable :robots="robots" :selected-ids="selectedIds" :max-selected="MAX_COMPARE" @toggle="toggle" />
    </div>

    <RobotCompareDialog v-model="compareOpen" :robots="selected" :ctx="specCtx" @remove="toggle" />
  </section>
</template>

<style scoped>
.catalog__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin: var(--space-4) 0 var(--space-3);
}

.catalog__count {
  font-weight: 500;
}

.catalog__compare {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.catalog__compare .el-button + .el-button {
  margin-left: 0;
}

.catalog__selected {
  color: var(--color-text-secondary);
}

.catalog__skeleton {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
</style>
