<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, DocumentDelete, Folder } from '@element-plus/icons-vue'
import { getObjectTypes } from '@/api/objectTypes'
import { getProject } from '@/api/projects'
import type { ObjectType, Project } from '@/types/api'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import { isApiError } from '@/utils/errors'
import { formatDate } from '@/utils/format'

const route = useRoute()

const project = ref<Project | null>(null)
const objectTypes = ref<ObjectType[]>([])
const error = ref<unknown>(null)
let requestSeq = 0

const projectId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const notFound = computed(() => isApiError(error.value) && error.value.code === 'NOT_FOUND')
const typeName = computed(() => {
  const code = project.value?.objectType
  return objectTypes.value.find((t) => t.code === code)?.name ?? code ?? ''
})

async function load() {
  const seq = ++requestSeq
  error.value = null
  project.value = null
  try {
    const [p, types] = await Promise.all([
      getProject(projectId.value),
      objectTypes.value.length ? Promise.resolve(objectTypes.value) : getObjectTypes(),
    ])
    if (seq !== requestSeq) return
    project.value = p
    objectTypes.value = types
    document.title = `${p.name} — Проект`
  } catch (e) {
    if (seq === requestSeq) error.value = e
  }
}

watch(projectId, (id) => id && load(), { immediate: true })
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

    <template v-else-if="error">
      <h1 class="page__title">Проект</h1>
      <ErrorAlert :error="error" retry @retry="load" />
    </template>

    <el-skeleton v-else-if="!project" :rows="3" animated aria-busy="true" aria-label="Загрузка проекта" />

    <template v-else>
      <header class="project__header">
        <h1 class="page__title project__title">{{ project.name }}</h1>
        <p class="project__meta">
          {{ typeName }} · изменён {{ formatDate(project.updatedAt, true) }}
        </p>
      </header>

      <EmptyState
        title="Мастер проекта в разработке"
        description="Здесь будет мастер оценки с сохранением параметров и история расчётов проекта."
        :icon="Folder"
      >
        <el-button @click="$router.push({ name: 'projects' })">Назад к проектам</el-button>
      </EmptyState>
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
</style>
