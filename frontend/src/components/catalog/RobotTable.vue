<script setup lang="ts">
import type { Robot } from '@/types/api'
import SourceBadge from '@/components/common/SourceBadge.vue'
import { rubOrNoData, withUnit } from '@/utils/robotSpecs'

const props = defineProps<{
  robots: Robot[]
  selectedIds: string[]
  maxSelected: number
}>()

const emit = defineEmits<{ toggle: [robot: Robot] }>()

function isSelected(id: string): boolean {
  return props.selectedIds.includes(id)
}

function isEmpty(value: number | null | undefined): boolean {
  return value == null
}

function isDisabled(id: string): boolean {
  return !isSelected(id) && props.selectedIds.length >= props.maxSelected
}
</script>

<template>
  <el-table :data="robots" row-key="id" class="robot-table" :border="false">
    <el-table-column width="52" fixed="left" align="center">
      <template #header><span class="visually-hidden">Сравнить</span></template>
      <template #default="{ row }">
        <el-tooltip
          :disabled="!isDisabled(row.id)"
          :content="`Для сравнения можно выбрать не больше ${maxSelected} роботов`"
          placement="right"
        >
          <el-checkbox
            :model-value="isSelected(row.id)"
            :disabled="isDisabled(row.id)"
            :aria-label="`Добавить к сравнению: ${row.name}`"
            @change="emit('toggle', row as Robot)"
          />
        </el-tooltip>
      </template>
    </el-table-column>

    <el-table-column label="Название" min-width="170" fixed="left">
      <template #default="{ row }">
        <RouterLink :to="{ name: 'robot', params: { id: row.id } }" class="robot-table__name">
          {{ row.name }}
        </RouterLink>
      </template>
    </el-table-column>
    <el-table-column prop="manufacturer" label="Производитель" min-width="140" show-overflow-tooltip />
    <el-table-column prop="solutionTypeName" label="Тип решения" min-width="150" show-overflow-tooltip />

    <el-table-column label="Грузоподъёмность" min-width="160" align="right">
      <template #default="{ row }">
        <span :class="{ 'no-data': isEmpty(row.specs.payloadKg) }">{{ withUnit(row.specs.payloadKg, 'кг') }}</span>
      </template>
    </el-table-column>
    <el-table-column label="Производительность" min-width="180" align="right">
      <template #default="{ row }">
        <span :class="{ 'no-data': isEmpty(row.specs.perfOpsPerHour) }">
          {{ withUnit(row.specs.perfOpsPerHour, 'опер./ч') }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="Цена" min-width="125" align="right">
      <template #default="{ row }">{{ rubOrNoData(row.price) }}</template>
    </el-table-column>
    <el-table-column label="RaaS / мес" min-width="115" align="right">
      <template #default="{ row }">
        <span :class="{ 'no-data': isEmpty(row.raasMonthlyPrice) }">
          {{ rubOrNoData(row.raasMonthlyPrice) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="Данные" width="150">
      <template #default="{ row }">
        <SourceBadge :confirmed="row.confirmed" :source="row.sourceUrl" :date="row.sourceDate" />
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.robot-table :deep(th .cell) {
  word-break: normal;
  white-space: nowrap;
}

.robot-table__name {
  font-weight: 500;
  text-decoration: none;
}

.robot-table__name:hover {
  text-decoration: underline;
}

.no-data {
  color: var(--color-text-secondary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
