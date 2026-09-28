<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Van } from '@element-plus/icons-vue'
import type { ObjectType, Robot } from '@/types/api'
import { getObjectTypes } from '@/api/objectTypes'
import { deleteRobot, getRobots } from '@/api/robots'
import { useWizardStore } from '@/stores/wizard'
import AdminRobotTable from '@/components/admin/AdminRobotTable.vue'
import RobotFormDrawer from '@/components/admin/RobotFormDrawer.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import { describeError } from '@/utils/errors'
import { searchRobots } from '@/utils/robotForm'

// Управление каталогом роботов: таблица с поиском, создание, редактирование, удаление.
const wizard = useWizardStore()

const robots = ref<Robot[] | null>(null)
const objectTypes = ref<ObjectType[]>([])
const loading = ref(false)
const error = ref<unknown>(null)
const query = ref('')

const filtered = computed(() => searchRobots(robots.value ?? [], query.value))
const objectTypeNames = computed(() => Object.fromEntries(objectTypes.value.map((t) => [t.code, t.name])))
const objectTypeOptions = computed(() => objectTypes.value.map((t) => ({ value: t.code, label: t.name })))
// Отдельного справочника типов решений в API нет — собираем из каталога.
const solutionTypeOptions = computed(() =>
  [...new Map((robots.value ?? []).map((r) => [r.solutionType, r.solutionTypeName]))]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [list, types] = await Promise.all([getRobots({ sort: 'name' }), objectTypes.value.length ? objectTypes.value : getObjectTypes()])
    robots.value = list
    objectTypes.value = types
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** Каталог изменился: перечитываем таблицу, мастер загрузит роботов заново. */
function catalogChanged() {
  wizard.invalidateRobots()
  void load()
}

// ---------- Создание и редактирование ----------
const drawerOpen = ref(false)
const editing = ref<Robot | null>(null)

function create() {
  editing.value = null
  drawerOpen.value = true
}

function edit(robot: Robot) {
  editing.value = robot
  drawerOpen.value = true
}

function onSaved(robot: Robot, created: boolean) {
  ElMessage.success(created ? `Робот «${robot.name}» добавлен в каталог` : `Изменения «${robot.name}» сохранены`)
  catalogChanged()
}

// ---------- Удаление ----------
async function remove(robot: Robot) {
  try {
    await ElMessageBox.confirm(
      `Робот «${robot.name}» пропадёт из каталога и перестанет участвовать в подборе. Сохранённые расчёты проектов не изменятся. Действие нельзя отменить.`,
      'Удалить робота?',
      { type: 'warning', confirmButtonText: 'Удалить', cancelButtonText: 'Отмена', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  try {
    await deleteRobot(robot.id)
    ElMessage.success(`Робот «${robot.name}» удалён из каталога`)
  } catch (e) {
    const text = describeError(e)
    ElMessage.error({ message: `Робот не удалён. ${text.title}. ${text.description}`, duration: 6000 })
  }
  catalogChanged()
}
</script>

<template>
  <section class="admin-robots">
    <header class="admin-robots__head">
      <h1 class="page__title admin-robots__title">Управление каталогом</h1>
      <el-button type="primary" :icon="Plus" :disabled="!robots" @click="create">Добавить робота</el-button>
    </header>

    <div class="admin-robots__bar">
      <el-input
        v-model="query"
        :prefix-icon="Search"
        clearable
        placeholder="Например, AMR или СеверТех"
        aria-label="Поиск по названию, производителю или типу решения"
        class="admin-robots__search"
      />
      <span v-if="robots" class="admin-robots__count" aria-live="polite">
        Показано: {{ filtered.length }} из {{ robots.length }}
      </span>
      <RouterLink :to="{ name: 'catalog' }" class="admin-robots__link">Открыть публичный каталог</RouterLink>
    </div>

    <ErrorAlert v-if="error" :error="error" retry @retry="load" />

    <el-skeleton v-else-if="robots === null" :rows="8" animated aria-busy="true" aria-label="Загрузка каталога" />

    <EmptyState
      v-else-if="robots.length === 0"
      title="Каталог пуст"
      description="Добавьте первого робота — он появится в публичном каталоге и в подборе."
      :icon="Van"
    >
      <el-button type="primary" :icon="Plus" @click="create">Добавить робота</el-button>
    </EmptyState>

    <EmptyState
      v-else-if="filtered.length === 0"
      title="Ничего не найдено"
      :description="`По запросу «${query.trim()}» роботов нет. Измените запрос или сбросьте поиск.`"
      :icon="Search"
    >
      <el-button type="primary" @click="query = ''">Сбросить поиск</el-button>
    </EmptyState>

    <div v-else v-loading="loading" element-loading-text="Обновляем список…">
      <AdminRobotTable :robots="filtered" :object-type-names="objectTypeNames" @edit="edit" @remove="remove" />
    </div>

    <RobotFormDrawer
      v-model="drawerOpen"
      :robot="editing"
      :object-type-options="objectTypeOptions"
      :solution-type-options="solutionTypeOptions"
      @saved="onSaved"
    />
  </section>
</template>

<style scoped>
.admin-robots__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.admin-robots__title {
  margin-bottom: 0;
}

.admin-robots__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.admin-robots__search {
  flex: 0 1 420px;
}

.admin-robots__count {
  color: var(--color-text-secondary);
}

.admin-robots__link {
  margin-left: auto;
}
</style>
