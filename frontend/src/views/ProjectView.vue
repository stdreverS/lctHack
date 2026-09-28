<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, DocumentDelete } from '@element-plus/icons-vue'
import { useWizardStore } from '@/stores/wizard'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import CalcHistoryPanel from '@/components/projects/CalcHistoryPanel.vue'
import CalcRecordView from '@/components/projects/CalcRecordView.vue'
import { isApiError } from '@/utils/errors'

const route = useRoute()
const wizard = useWizardStore()

const projectId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const notFound = computed(() => isApiError(wizard.projectError) && wizard.projectError.code === 'NOT_FOUND')
const loaded = computed(
  () => wizard.mode === 'project' && wizard.projectId === projectId.value && !wizard.projectLoading && !wizard.projectError,
)

/** Расчёт из истории, открытый для просмотра; null — показывается мастер. */
const viewingId = ref<string | null>(null)

function load() {
  viewingId.value = null
  if (projectId.value) void wizard.openProject(projectId.value)
}

function goExport() {
  viewingId.value = null
  wizard.goTo(7)
}

watch(projectId, load, { immediate: true })

watch(
  () => (loaded.value ? wizard.projectName : ''),
  (name) => {
    if (name) document.title = `${name} — Проект`
  },
)
</script>

<template>
  <section>
    <el-button link :icon="ArrowLeft" class="project__back" @click="$router.push({ name: 'projects' })">
      Назад к проектам
    </el-button>

    <EmptyState
      v-if="notFound"
      title="Проект не найден"
      description="Возможно, проект удалён или ссылка устарела. Откройте проект из списка."
      :icon="DocumentDelete"
    >
      <RouterLink :to="{ name: 'projects' }">Перейти к списку проектов</RouterLink>
    </EmptyState>

    <template v-else-if="wizard.projectError">
      <h1 class="page__title">Проект</h1>
      <ErrorAlert :error="wizard.projectError" retry @retry="load" />
    </template>

    <el-skeleton v-else-if="!loaded" :rows="4" animated aria-busy="true" aria-label="Загрузка проекта" />

    <template v-else>
      <header class="project__header">
        <h1 class="page__title project__title">{{ wizard.projectName }}</h1>
        <p class="project__meta">{{ wizard.currentType?.name ?? wizard.objectType }}</p>
      </header>
      <div class="project__body">
        <div class="project__main">
          <!-- v-show: мастер не размонтируется, его состояние и защита от ухода без сохранения остаются. -->
          <WizardShell v-show="!viewingId" />
          <CalcRecordView v-if="viewingId" :calculation-id="viewingId" @close="viewingId = null" />
        </div>
        <CalcHistoryPanel
          class="project__history"
          :project-id="projectId"
          :active-id="viewingId"
          :refresh-key="wizard.calculationId"
          @open="(id) => (viewingId = id)"
          @go-export="goExport"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.project__back {
  margin-bottom: var(--space-3);
}

.project__header {
  margin-bottom: var(--space-4);
}

.project__title {
  margin-bottom: var(--space-1);
}

.project__meta {
  color: var(--color-text-secondary);
}

.project__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  align-items: start;
  gap: var(--space-4);
}

.project__main {
  min-width: 0;
}

.project__history {
  position: sticky;
  top: calc(56px + var(--space-4)); /* под шапкой приложения */
}

/* Узкий экран: история — под мастером. */
@media (max-width: 1100px) {
  .project__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .project__history {
    position: static;
  }
}
</style>
