<script setup lang="ts">
import { computed, h, nextTick, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import type { RecommendationItem } from '@/types/api'
import { useWizardStore } from '@/stores/wizard'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import RecommendGroup from '@/components/wizard/RecommendGroup.vue'
import { MAX_COMPARE, failedCritical, groupRecommendations } from '@/utils/recommendation'

const wizard = useWizardStore()

const attempted = ref(false)
const problemRef = ref<HTMLElement>()

const groups = computed(() => groupRecommendations(wizard.recommendation?.recommendation ?? []))
const total = computed(() => wizard.recommendation?.recommendation.length ?? 0)
const limitReached = computed(() => wizard.selectedRobotIds.length >= MAX_COMPARE)
const selectedNames = computed(() =>
  wizard.selectedRobotIds.map((id) => ({
    id,
    name:
      wizard.recommendation?.recommendation.find((i) => i.robotId === id)?.name ?? wizard.robotById.get(id)?.name ?? id,
  })),
)

const problem = computed(() => {
  if (!attempted.value) return ''
  if (wizard.recommendStale) return 'Параметры изменились — пересчитайте подбор, прежде чем переходить к сравнению.'
  if (!wizard.selectedRobotIds.length) return 'Отметьте «Сравнить» хотя бы у одного робота, чтобы перейти к сравнению.'
  return ''
})

async function run() {
  const dropped = await wizard.runRecommendation()
  if (dropped.length) {
    ElMessage.warning({
      message: `Сняты с выбора — больше не подходят по новым параметрам: ${dropped.join(', ')}`,
      duration: 6000,
    })
  }
}

onMounted(() => {
  // Первый вход — считаем сразу; при изменённых параметрах пересчёт запускает пользователь (баннер).
  if (!wizard.recommendation && !wizard.recommendLoading) void run()
})

function typeName(item: RecommendationItem): string {
  return wizard.robotById.get(item.robotId)?.solutionTypeName ?? item.solutionType
}

async function toggle(item: RecommendationItem, selected: boolean) {
  if (!selected || item.status !== 'excluded') {
    wizard.toggleRobot(item.robotId, selected)
    return
  }
  const message = h('div', { class: 'manual-confirm' }, [
    h('p', 'Робот не прошёл критические проверки:'),
    h('ul', failedCritical(item).map((c) => h('li', c.message))),
    h('p', 'Результаты сравнения и экономики для него могут быть недостоверны. Дальше он будет отмечен как «добавлен вручную».'),
  ])
  try {
    await ElMessageBox.confirm(message, `Добавить «${item.name}» вручную?`, {
      type: 'warning',
      confirmButtonText: 'Добавить вручную',
      cancelButtonText: 'Отмена',
    })
    wizard.toggleRobot(item.robotId, true, true)
  } catch {
    // пользователь отказался — ничего не меняем
  }
}

async function validate(): Promise<boolean> {
  attempted.value = true
  if (!problem.value) return true
  await nextTick()
  problemRef.value?.focus()
  return false
}

defineExpose({ validate })
</script>

<template>
  <div class="step-rec">
    <el-skeleton
      v-if="wizard.recommendLoading && !wizard.recommendation"
      :rows="6"
      animated
      aria-busy="true"
      aria-label="Подбираем роботов"
    />

    <ErrorAlert v-else-if="wizard.recommendError && !wizard.recommendation" :error="wizard.recommendError" retry @retry="run" />

    <EmptyState
      v-else-if="wizard.recommendation && total === 0"
      title="В каталоге нет роботов для этого объекта"
      description="Для выбранного типа объекта и процессов подходящих решений не найдено. Попробуйте выбрать другие процессы на шаге «Объект» или посмотрите весь каталог."
      :icon="Search"
    >
      <el-button @click="wizard.goTo(0)">Изменить процессы</el-button>
      <RouterLink :to="{ name: 'catalog' }" target="_blank">Открыть каталог</RouterLink>
    </EmptyState>

    <template v-else-if="wizard.recommendation">
      <el-alert v-if="wizard.recommendStale" type="warning" :closable="false" show-icon class="step-rec__stale">
        <template #title>Параметры изменены, пересчитайте подбор</template>
        <p>Результаты ниже рассчитаны для прежних параметров объекта и могут быть неактуальны.</p>
        <el-button type="primary" size="small" :icon="Refresh" :loading="wizard.recommendLoading" @click="run">
          Пересчитать подбор
        </el-button>
      </el-alert>
      <ErrorAlert v-if="wizard.recommendError" :error="wizard.recommendError" retry @retry="run" />

      <div class="step-rec__bar" :aria-busy="wizard.recommendLoading">
        <p class="step-rec__intro">
          Проверено роботов: {{ total }}. Выберите до {{ MAX_COMPARE }} для сравнения на следующем шаге.
        </p>
        <div class="step-rec__picked" aria-live="polite">
          <span class="step-rec__count num">Выбрано {{ wizard.selectedRobotIds.length }} из {{ MAX_COMPARE }}</span>
          <el-tag
            v-for="r in selectedNames"
            :key="r.id"
            closable
            disable-transitions
            @close="wizard.toggleRobot(r.id, false)"
          >
            {{ r.name }}
          </el-tag>
        </div>
      </div>

      <p v-if="problem" ref="problemRef" class="step-rec__problem" role="alert" tabindex="-1">{{ problem }}</p>

      <RecommendGroup
        v-for="group in groups"
        :key="group.status"
        :group="group"
        :collapsible="group.status === 'excluded'"
        :selected-ids="wizard.selectedRobotIds"
        :manual-ids="wizard.manualRobotIds"
        :limit-reached="limitReached"
        :type-name="typeName"
        @toggle="toggle"
      />

      <p class="step-rec__disclaimer">{{ wizard.recommendation.disclaimer }}</p>
    </template>
  </div>
</template>

<style scoped>
.step-rec {
  display: grid;
  gap: var(--space-4);
}

.step-rec__stale p {
  margin: 0 0 var(--space-2);
  color: var(--color-text);
}

.step-rec__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.step-rec__intro {
  color: var(--color-text-secondary);
}

.step-rec__picked {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.step-rec__count {
  font-weight: 600;
}

.step-rec__problem {
  padding: var(--space-2) var(--space-3);
  color: var(--color-danger);
  background: var(--el-color-danger-light-9);
  border-left: 3px solid var(--color-danger);
}

.step-rec__problem:focus {
  outline: none;
}







.step-rec__disclaimer {
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>

<!-- Диалог ElMessageBox рендерится вне компонента, поэтому стили не scoped. -->
<style>
.manual-confirm {
  display: grid;
  gap: var(--space-2);
}

.manual-confirm ul {
  padding-left: var(--space-4);
  list-style: disc;
}
</style>
