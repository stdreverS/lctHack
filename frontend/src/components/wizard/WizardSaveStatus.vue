<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { useWizardStore } from '@/stores/wizard'
import { describeError } from '@/utils/errors'
import { formatDate } from '@/utils/format'

// Статус сохранения проекта и кнопка «Сохранить проект» в подвале мастера.
// В гостевом режиме занимает место между «Назад» и «Далее», ничего не показывая.
const wizard = useWizardStore()

async function save() {
  try {
    await wizard.save()
    ElMessage.success('Проект сохранён')
  } catch (e) {
    const text = describeError(e)
    ElMessage.error({ message: `Проект не сохранён. ${text.title}. ${text.description}`, duration: 6000 })
  }
}
</script>

<template>
  <div class="save-status">
    <template v-if="wizard.mode === 'project'">
      <span aria-live="polite">
        <span v-if="wizard.hasUnsavedChanges" class="save-status__unsaved">
          <el-icon class="save-status__icon" :size="16" aria-hidden="true"><WarningFilled /></el-icon>
          <span>
            <strong>Есть несохранённые изменения.</strong>
            Нажмите «Сохранить проект», иначе при уходе со страницы они пропадут.
          </span>
        </span>
        <span v-else-if="wizard.projectUpdatedAt" class="save-status__saved">
          Сохранено {{ formatDate(wizard.projectUpdatedAt, true) }}
        </span>
      </span>
      <el-button :loading="wizard.saving" :disabled="!wizard.hasUnsavedChanges" @click="save">
        Сохранить проект
      </el-button>
    </template>
  </div>
</template>

<style scoped>
.save-status {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

.save-status__saved {
  color: var(--color-text-secondary);
  font-size: 13px;
}

/* Янтарный — «требует внимания» (CLAUDE.md, раздел 8); текст тёмный ради контраста. */
.save-status__unsaved {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-2);
  max-width: 520px;
  padding: 6px var(--space-3);
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-left: 3px solid var(--color-warning);
  border-radius: var(--radius);
}

.save-status__icon {
  flex: none;
  margin-top: 1px;
  color: var(--color-warning);
}

.save-status__unsaved strong {
  font-weight: 600;
}
</style>
