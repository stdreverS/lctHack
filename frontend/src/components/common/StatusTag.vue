<script setup lang="ts">
import type { RecStatus } from '@/types/api'
import { STATUS_LABELS } from '@/utils/recommendation'

// Статус робота по итогам подбора: цвет + текст (цвет не единственный носитель смысла).
defineProps<{ status: RecStatus }>()
</script>

<template>
  <span class="status-tag" :class="`status-tag--${status}`">
    <span class="status-tag__dot" aria-hidden="true"></span>{{ STATUS_LABELS[status] }}
  </span>
</template>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--space-2);
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
  white-space: nowrap;
  border-radius: var(--radius);
}

.status-tag__dot {
  width: 8px;
  height: 8px;
  background: var(--status-color);
  border-radius: 50%;
}

.status-tag--recommended {
  --status-color: var(--color-success);
  background: var(--el-color-success-light-9);
  color: color-mix(in srgb, var(--color-success) 75%, black);
}

.status-tag--needs_check {
  --status-color: var(--color-warning);
  background: var(--el-color-warning-light-9);
  color: color-mix(in srgb, var(--color-warning) 60%, black);
}

.status-tag--excluded {
  --status-color: var(--color-danger);
  background: var(--el-color-danger-light-9);
  color: color-mix(in srgb, var(--color-danger) 80%, black);
}
</style>
