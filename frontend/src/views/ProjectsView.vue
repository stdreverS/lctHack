<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Folder, Plus } from '@element-plus/icons-vue'
import { getObjectTypes } from '@/api/objectTypes'
import { copyProject, deleteProject, getProjects } from '@/api/projects'
import type { ObjectType, Project, ProjectSummary } from '@/types/api'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import NewProjectDialog from '@/components/projects/NewProjectDialog.vue'
import { describeError } from '@/utils/errors'
import { formatDate, formatYears } from '@/utils/format'
import { paybackLevel } from '@/utils/projects'

const router = useRouter()

const projects = ref<ProjectSummary[] | null>(null)
const objectTypes = ref<ObjectType[]>([])
const error = ref<unknown>(null)
const dialogOpen = ref(false)
/** id проекта, над которым сейчас выполняется действие (копирование/удаление). */
const busyId = ref<string | null>(null)

const typeNames = computed(() => new Map(objectTypes.value.map((t) => [t.code, t.name])))

async function load() {
  error.value = null
  try {
    const [list, types] = await Promise.all([
      getProjects(),
      objectTypes.value.length ? Promise.resolve(objectTypes.value) : getObjectTypes(),
    ])
    projects.value = list
    objectTypes.value = types
  } catch (e) {
    error.value = e
  }
}

void load()

function showActionError(e: unknown) {
  const text = describeError(e)
  ElMessage.error({ message: `${text.title}. ${text.description}`, duration: 6000 })
}

function open(id: string) {
  void router.push({ name: 'project', params: { id } })
}

function onCreated(project: Project) {
  open(project.id)
}

async function copy(row: ProjectSummary) {
  busyId.value = row.id
  try {
    const created = await copyProject(row.id)
    ElMessage.success(`Создана копия: «${created.name}»`)
    await load()
  } catch (e) {
    showActionError(e)
  } finally {
    busyId.value = null
  }
}

async function remove(row: ProjectSummary) {
  try {
    await ElMessageBox.confirm(
      `Проект «${row.name}» и вся история его расчётов будут удалены. Отменить это действие нельзя.`,
      'Удалить проект?',
      { type: 'warning', confirmButtonText: 'Удалить проект', cancelButtonText: 'Отмена', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return // пользователь передумал
  }
  busyId.value = row.id
  try {
    await deleteProject(row.id)
    projects.value = projects.value?.filter((p) => p.id !== row.id) ?? null
    ElMessage.success('Проект удалён')
  } catch (e) {
    showActionError(e)
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <section>
    <header class="projects__header">
      <h1 class="page__title projects__title">Мои проекты</h1>
      <el-button v-if="projects?.length" type="primary" :icon="Plus" @click="dialogOpen = true">
        Новый проект
      </el-button>
    </header>

    <ErrorAlert v-if="error" :error="error" retry @retry="load" />

    <el-skeleton v-else-if="projects === null" :rows="5" animated class="projects__skeleton" />

    <EmptyState
      v-else-if="projects.length === 0"
      title="Создайте первый проект"
      description="В проекте сохраняются параметры объекта, сценарии и история расчётов. Начните с названия и типа объекта."
      :icon="Folder"
    >
      <el-button type="primary" :icon="Plus" @click="dialogOpen = true">Новый проект</el-button>
      <el-button @click="router.push('/demo')">Оценка без сохранения</el-button>
    </EmptyState>

    <el-table v-else :data="projects" row-key="id" class="projects__table">
      <el-table-column label="Название" min-width="280">
        <template #default="{ row }">
          <RouterLink :to="{ name: 'project', params: { id: row.id } }" class="projects__name">{{ row.name }}</RouterLink>
        </template>
      </el-table-column>
      <el-table-column label="Тип объекта" min-width="130">
        <template #default="{ row }">{{ typeNames.get(row.objectType) ?? row.objectType }}</template>
      </el-table-column>
      <el-table-column label="Изменён" width="150">
        <template #default="{ row }">{{ formatDate(row.updatedAt, true) }}</template>
      </el-table-column>
      <el-table-column label="Последняя окупаемость" width="190">
        <template #default="{ row }">
          <span :class="['payback', `payback--${paybackLevel(row.lastPaybackYears)}`]">
            {{ row.lastPaybackYears === null ? 'Нет данных' : formatYears(row.lastPaybackYears) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="Действия" width="290" align="right">
        <template #default="{ row }">
          <div class="projects__actions">
            <el-button size="small" type="primary" plain @click="open(row.id)">Открыть</el-button>
            <el-button size="small" :disabled="busyId !== null" :loading="busyId === row.id" @click="copy(row as ProjectSummary)">
              Копировать
            </el-button>
            <el-button size="small" type="danger" plain :disabled="busyId !== null" @click="remove(row as ProjectSummary)">
              Удалить
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="projects?.length" class="projects__legend">
      Окупаемость — по лучшему сценарию последнего расчёта:
      <span class="payback payback--good">до 3 лет</span>,
      <span class="payback payback--moderate">3–5 лет</span>,
      <span class="payback payback--poor">более 5 лет</span>.
      «Нет данных» — расчёт ещё не выполнялся или проект не окупается.
    </p>

    <NewProjectDialog v-model="dialogOpen" :object-types="objectTypes" @created="onCreated" />
  </section>
</template>

<style scoped>
.projects__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.projects__title {
  margin-bottom: 0;
}

.projects__skeleton,
.projects__table {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.projects__skeleton {
  padding: var(--space-4);
  background: var(--color-surface);
}

.projects__name {
  font-weight: 500;
  text-decoration: none;
}

.projects__name:hover {
  text-decoration: underline;
}

.projects__actions {
  display: inline-flex;
  gap: var(--space-2);
}

.projects__actions .el-button + .el-button {
  margin-left: 0;
}

.payback {
  font-weight: 500;
  white-space: nowrap;
}

.payback--good {
  color: var(--color-success);
}

.payback--moderate {
  color: var(--color-warning);
}

.payback--poor {
  color: var(--color-danger);
}

.payback--none {
  color: var(--color-text-secondary);
  font-weight: 400;
}

.projects__legend {
  margin-top: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
