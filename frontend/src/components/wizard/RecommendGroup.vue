<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import type { RecommendationItem } from '@/types/api'
import RecommendCard from '@/components/wizard/RecommendCard.vue'
import type { RecGroup } from '@/utils/recommendation'

// Группа результатов подбора («Рекомендовано», «Требует проверки», «Не подходит»).
const props = defineProps<{
  group: RecGroup
  /** Группа сворачивается и по умолчанию свёрнута. */
  collapsible?: boolean
  selectedIds: string[]
  manualIds: string[]
  limitReached: boolean
  typeName: (item: RecommendationItem) => string
}>()

const emit = defineEmits<{ toggle: [item: RecommendationItem, selected: boolean] }>()

const open = ref(!props.collapsible)
</script>

<template>
  <section class="rec-group" :aria-label="group.label">
    <h3 class="rec-group__title">
      <button v-if="collapsible" type="button" class="rec-group__toggle" :aria-expanded="open" @click="open = !open">
        <el-icon aria-hidden="true"><component :is="open ? ArrowDown : ArrowRight" /></el-icon>
        {{ group.label }} <span class="rec-group__num num">{{ group.items.length }}</span>
      </button>
      <template v-else>
        {{ group.label }} <span class="rec-group__num num">{{ group.items.length }}</span>
      </template>
    </h3>

    <template v-if="open">
      <p v-if="!group.items.length" class="rec-group__note">Нет роботов с таким статусом.</p>
      <p v-else-if="group.status === 'excluded'" class="rec-group__note">
        Эти роботы не прошли критические проверки. Добавить такого робота к сравнению можно только вручную,
        с подтверждением.
      </p>
      <div class="rec-group__list">
        <RecommendCard
          v-for="item in group.items"
          :key="item.robotId"
          :item="item"
          :type-name="typeName(item)"
          :selected="selectedIds.includes(item.robotId)"
          :manual="manualIds.includes(item.robotId)"
          :limit-reached="limitReached"
          @toggle="(v) => emit('toggle', item, v)"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.rec-group {
  display: grid;
  gap: var(--space-3);
}

.rec-group__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 16px;
  font-weight: 600;
}

.rec-group__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0;
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.rec-group__num {
  padding: 0 var(--space-2);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 400;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.rec-group__note {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.rec-group__list {
  display: grid;
  gap: var(--space-3);
}
</style>
