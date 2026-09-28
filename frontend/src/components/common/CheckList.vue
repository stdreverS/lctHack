<script setup lang="ts">
import { CircleCheckFilled, CircleCloseFilled, QuestionFilled } from '@element-plus/icons-vue'
import type { Check, CheckResult } from '@/types/api'
import { checkValues } from '@/utils/recommendation'

// Проверки ограничений робота: иконка результата, «требуется X, у робота Y», пояснение сервера.
defineProps<{ checks: Check[] }>()

const RESULT: Record<CheckResult, { icon: typeof CircleCheckFilled; label: string }> = {
  pass: { icon: CircleCheckFilled, label: 'Пройдена' },
  fail: { icon: CircleCloseFilled, label: 'Не пройдена' },
  unknown: { icon: QuestionFilled, label: 'Нет данных для проверки' },
}
</script>

<template>
  <ul class="check-list">
    <li v-for="c in checks" :key="c.rule" class="check-list__item" :class="`check-list__item--${c.result}`">
      <el-icon class="check-list__icon" :size="16" role="img" :aria-label="RESULT[c.result].label">
        <component :is="RESULT[c.result].icon" />
      </el-icon>
      <div class="check-list__body">
        <p class="check-list__title">
          {{ c.label }}
          <span v-if="c.critical" class="check-list__critical">критичная</span>
          <span v-if="checkValues(c)" class="check-list__values num">— {{ checkValues(c) }}</span>
        </p>
        <p class="check-list__message">{{ c.message }}</p>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.check-list {
  display: grid;
  gap: var(--space-2);
}

.check-list__item {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: var(--space-2);
  align-items: start;
}

.check-list__icon {
  margin-top: 2px;
}

.check-list__item--pass .check-list__icon {
  color: var(--color-success);
}

.check-list__item--fail .check-list__icon {
  color: var(--color-danger);
}

.check-list__item--unknown .check-list__icon {
  color: var(--color-warning);
}

.check-list__title {
  font-weight: 600;
}

.check-list__critical {
  margin: 0 var(--space-1);
  padding: 0 var(--space-1);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 400;
  border: 1px solid var(--color-border);
  border-radius: 2px;
}

.check-list__values {
  font-weight: 400;
}

.check-list__message {
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
