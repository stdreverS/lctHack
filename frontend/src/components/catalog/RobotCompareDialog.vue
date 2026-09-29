<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Robot } from '@/types/api'
import CompareTable from '@/components/common/CompareTable.vue'
import { buildComparison, type SpecContext } from '@/utils/robotSpecs'

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

    <CompareTable :robots="robots" :groups="groups" max-height="68vh">
      <template #robot="{ robot }">
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
      </template>
    </CompareTable>
    <p v-if="groups.length === 0" class="compare__empty">Все характеристики выбранных роботов совпадают.</p>

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

.compare__robot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.compare__empty {
  padding: var(--space-4);
  color: var(--color-text-secondary);
  text-align: center;
}
</style>
