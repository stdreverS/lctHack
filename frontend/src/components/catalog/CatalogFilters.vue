<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { SORT_OPTIONS, type CatalogFilters } from '@/utils/catalogQuery'

const props = defineProps<{
  filters: CatalogFilters
  objectTypeOptions: { value: string; label: string }[]
  solutionTypeOptions: { value: string; label: string }[]
}>()

const emit = defineEmits<{ change: [filters: CatalogFilters] }>()

// Поиск применяется с задержкой, чтобы не делать запрос на каждую букву.
const SEARCH_DELAY_MS = 350
const search = ref(props.filters.q)
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.filters.q,
  (q) => {
    if (q !== search.value.trim()) search.value = q
  },
)

function update(patch: Partial<CatalogFilters>) {
  emit('change', { ...props.filters, ...patch })
}

function onSearchInput() {
  clearTimeout(timer)
  timer = setTimeout(applySearch, SEARCH_DELAY_MS)
}

function applySearch() {
  clearTimeout(timer)
  if (search.value.trim() !== props.filters.q) update({ q: search.value.trim() })
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <form class="catalog-filters" role="search" aria-label="Фильтры каталога" @submit.prevent="applySearch">
    <div class="catalog-filters__field catalog-filters__field--search">
      <label class="catalog-filters__label" for="catalog-q">Поиск</label>
      <el-input
        id="catalog-q"
        v-model="search"
        :prefix-icon="Search"
        placeholder="Например, Логимов или AMR-600"
        clearable
        @input="onSearchInput"
        @clear="applySearch"
      />
    </div>
    <div class="catalog-filters__field">
      <label class="catalog-filters__label" for="catalog-object-type">Тип объекта</label>
      <el-select
        id="catalog-object-type"
        :model-value="filters.objectType"
        placeholder="Все объекты"
        clearable
        @update:model-value="(v: string | undefined) => update({ objectType: v ?? '' })"
      >
        <el-option v-for="o in objectTypeOptions" :key="o.value" :value="o.value" :label="o.label" />
      </el-select>
    </div>
    <div class="catalog-filters__field">
      <label class="catalog-filters__label" for="catalog-solution-type">Тип решения</label>
      <el-select
        id="catalog-solution-type"
        :model-value="filters.solutionType"
        placeholder="Все решения"
        clearable
        @update:model-value="(v: string | undefined) => update({ solutionType: v ?? '' })"
      >
        <el-option v-for="o in solutionTypeOptions" :key="o.value" :value="o.value" :label="o.label" />
      </el-select>
    </div>
    <div class="catalog-filters__field">
      <label class="catalog-filters__label" for="catalog-sort">Сортировка</label>
      <el-select
        id="catalog-sort"
        :model-value="filters.sort"
        @update:model-value="(v: CatalogFilters['sort']) => update({ sort: v })"
      >
        <el-option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
      </el-select>
    </div>
  </form>
</template>

<style scoped>
.catalog-filters {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(160px, 1fr));
  gap: var(--space-3);
  align-items: end;
}

.catalog-filters__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.catalog-filters__label {
  color: var(--color-text-secondary);
  font-size: 12px;
}

@media (max-width: 900px) {
  .catalog-filters {
    grid-template-columns: 1fr 1fr;
  }

  .catalog-filters__field--search {
    grid-column: 1 / -1;
  }
}
</style>
