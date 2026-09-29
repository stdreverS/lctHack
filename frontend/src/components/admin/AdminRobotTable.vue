<script setup lang="ts">
import { Delete, Edit } from '@element-plus/icons-vue'
import type { Robot } from '@/types/api'
import SourceBadge from '@/components/common/SourceBadge.vue'
import { formatDate } from '@/utils/format'
import { NO_DATA, rubOrNoData, withUnit } from '@/utils/robotSpecs'

// Таблица каталога для администратора: те же колонки, что в публичном каталоге,
// плюс статус подтверждённости данных, дата данных и действия.
const props = defineProps<{
  robots: Robot[]
  /** Названия типов объектов по коду. */
  objectTypeNames: Record<string, string>
}>()

const emit = defineEmits<{ edit: [robot: Robot]; remove: [robot: Robot] }>()

function objectTypes(robot: Robot): string {
  return robot.objectTypes.map((code) => props.objectTypeNames[code] ?? code).join(', ') || NO_DATA
}
</script>

<template>
  <el-table :data="robots" row-key="id" class="admin-table">
    <el-table-column label="Название" min-width="170" fixed="left">
      <template #default="{ row }">
        <RouterLink :to="{ name: 'robot', params: { id: row.id } }" class="admin-table__name">{{ row.name }}</RouterLink>
      </template>
    </el-table-column>
    <el-table-column prop="manufacturer" label="Производитель" min-width="140" show-overflow-tooltip />
    <el-table-column prop="solutionTypeName" label="Тип решения" min-width="150" show-overflow-tooltip />
    <el-table-column label="Типы объектов" min-width="140" show-overflow-tooltip>
      <template #default="{ row }">{{ objectTypes(row as Robot) }}</template>
    </el-table-column>
    <el-table-column label="Грузоподъёмность" min-width="160" align="right">
      <template #default="{ row }">
        <span class="num" :class="{ 'no-data': row.specs.payloadKg == null }">{{ withUnit(row.specs.payloadKg, 'кг') }}</span>
      </template>
    </el-table-column>
    <el-table-column label="Производительность" min-width="180" align="right">
      <template #default="{ row }">
        <span class="num" :class="{ 'no-data': row.specs.perfOpsPerHour == null }">
          {{ withUnit(row.specs.perfOpsPerHour, 'опер./ч') }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="Цена" min-width="125" align="right">
      <template #default="{ row }"><span class="num">{{ rubOrNoData(row.price) }}</span></template>
    </el-table-column>
    <el-table-column label="RaaS / мес" min-width="115" align="right">
      <template #default="{ row }">
        <span class="num" :class="{ 'no-data': row.raasMonthlyPrice == null }">{{ rubOrNoData(row.raasMonthlyPrice) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="Статус данных" width="140">
      <template #default="{ row }">
        <SourceBadge :confirmed="row.confirmed" :source="row.sourceUrl" :date="row.sourceDate" />
      </template>
    </el-table-column>
    <el-table-column label="Дата данных" width="115">
      <template #default="{ row }">
        <span class="num" :class="{ 'no-data': !row.sourceDate }">{{ row.sourceDate ? formatDate(row.sourceDate) : NO_DATA }}</span>
      </template>
    </el-table-column>
    <el-table-column label="Действия" width="112" fixed="right" align="center">
      <template #default="{ row }">
        <el-tooltip content="Изменить" placement="top" :show-after="200">
          <el-button link type="primary" :icon="Edit" :aria-label="`Изменить: ${row.name}`" @click="emit('edit', row as Robot)" />
        </el-tooltip>
        <el-tooltip content="Удалить" placement="top" :show-after="200">
          <el-button link type="danger" :icon="Delete" :aria-label="`Удалить: ${row.name}`" @click="emit('remove', row as Robot)" />
        </el-tooltip>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.admin-table :deep(th .cell) {
  word-break: normal;
  white-space: nowrap;
}

.admin-table__name {
  font-weight: 500;
  text-decoration: none;
}

.admin-table__name:hover {
  text-decoration: underline;
}

.no-data {
  color: var(--color-text-secondary);
}
</style>
