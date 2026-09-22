<script setup lang="ts">
import type { Component } from 'vue'
import { Box } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: Component
  }>(),
  { description: '', icon: () => Box },
)
</script>

<template>
  <section class="empty-state">
    <el-icon class="empty-state__icon" :size="40" aria-hidden="true"><component :is="icon" /></el-icon>
    <h2 class="empty-state__title">{{ title }}</h2>
    <p v-if="description" class="empty-state__text">{{ description }}</p>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
}

.empty-state__icon {
  color: var(--color-text-secondary);
}

.empty-state__title {
  margin-top: var(--space-3);
  font-size: 18px;
  font-weight: 600;
}

.empty-state__text {
  max-width: 520px;
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.empty-state__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
