<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useWizardStore, WIZARD_STEP_COUNT } from '@/stores/wizard'
import StepObject from '@/components/wizard/StepObject.vue'
import StepParams from '@/components/wizard/StepParams.vue'
import StepRecommend from '@/components/wizard/StepRecommend.vue'
import StepCompare from '@/components/wizard/StepCompare.vue'
import StepEconomics from '@/components/wizard/StepEconomics.vue'
import StepWhatIf from '@/components/wizard/StepWhatIf.vue'
import StepSimulation from '@/components/wizard/StepSimulation.vue'
import StepExport from '@/components/wizard/StepExport.vue'
import WizardSaveStatus from '@/components/wizard/WizardSaveStatus.vue'

// Мастер из 8 шагов — один компонент для гостя (/demo) и проекта (/app/projects/:id).
interface StepDef {
  title: string
  heading: string
  component: Component
  props?: Record<string, unknown>
}

const STEPS: StepDef[] = [
  { title: 'Объект', heading: 'Объект и процессы', component: StepObject },
  { title: 'Параметры', heading: 'Параметры объекта', component: StepParams },
  { title: 'Подбор', heading: 'Подбор роботов', component: StepRecommend },
  { title: 'Сравнение', heading: 'Сравнение и выбор решений', component: StepCompare },
  { title: 'Экономика', heading: 'Экономика сценариев', component: StepEconomics },
  { title: 'What-if', heading: 'Анализ «что если»', component: StepWhatIf },
  { title: 'Симуляция', heading: '2D-симуляция', component: StepSimulation },
  { title: 'Экспорт', heading: 'Итоги и экспорт', component: StepExport },
]
if (STEPS.length !== WIZARD_STEP_COUNT) throw new Error('WizardShell: число шагов не совпадает с WIZARD_STEP_COUNT')

const wizard = useWizardStore()
const auth = useAuthStore()

const stepRef = ref<{ validate?: () => boolean | Promise<boolean> } | null>(null)
const headingRef = ref<HTMLElement>()
const checking = ref(false)

const current = computed(() => STEPS[wizard.step]!)
const isFirst = computed(() => wizard.step === 0)
const isLast = computed(() => wizard.step === STEPS.length - 1)

async function go(index: number) {
  wizard.goTo(index)
  await nextTick()
  headingRef.value?.focus({ preventScroll: true })
  headingRef.value?.scrollIntoView({ block: 'nearest' })
}

async function next() {
  if (checking.value) return
  checking.value = true
  try {
    const valid = (await stepRef.value?.validate?.()) ?? true
    if (valid) await go(wizard.step + 1)
  } finally {
    checking.value = false
  }
}

// ---------- Несохранённые изменения ----------
async function confirmLeave(): Promise<boolean> {
  // После выхода из системы сохранить уже нельзя — не задерживаем.
  if (!wizard.hasUnsavedChanges || !auth.isLoggedIn) return true
  try {
    await ElMessageBox.confirm(
      'В проекте есть несохранённые изменения. Если уйти со страницы, они будут потеряны.',
      'Уйти без сохранения?',
      { type: 'warning', confirmButtonText: 'Уйти без сохранения', cancelButtonText: 'Остаться' },
    )
    return true
  } catch {
    return false
  }
}

onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(confirmLeave)

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!wizard.hasUnsavedChanges) return
  event.preventDefault()
  event.returnValue = '' // Chrome показывает стандартное предупреждение браузера
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<template>
  <div class="wizard">
    <nav class="wizard__steps" aria-label="Шаги мастера">
      <el-steps :active="wizard.step" finish-status="finish" process-status="process" align-center>
        <el-step
          v-for="(s, i) in STEPS"
          :key="s.title"
          :title="s.title"
          :aria-current="i === wizard.step ? 'step' : undefined"
        />
      </el-steps>
    </nav>

    <section class="wizard__body" aria-labelledby="wizard-heading">
      <h2 id="wizard-heading" ref="headingRef" class="wizard__heading" tabindex="-1">
        <span class="wizard__counter">Шаг {{ wizard.step + 1 }} из {{ STEPS.length }}</span>
        {{ current.heading }}
      </h2>
      <component :is="current.component" ref="stepRef" :key="wizard.step" v-bind="current.props" />
    </section>

    <footer class="wizard__footer">
      <el-button v-if="!isFirst" :icon="ArrowLeft" @click="go(wizard.step - 1)">
        Назад: {{ STEPS[wizard.step - 1]?.title }}
      </el-button>

      <WizardSaveStatus />

      <el-button v-if="!isLast" type="primary" :loading="checking" @click="next">
        Далее: {{ STEPS[wizard.step + 1]?.title }}
        <el-icon class="el-icon--right"><ArrowRight /></el-icon>
      </el-button>
    </footer>
  </div>
</template>

<style scoped>
.wizard {
  display: grid;
  gap: var(--space-4);
}

.wizard__steps {
  padding: var(--space-4) var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

/* Активный шаг — «разметочный» жёлтый (CLAUDE.md, раздел 8); текст остаётся тёмным для контраста. */
.wizard__steps :deep(.el-step__head.is-process) {
  color: var(--color-text);
  border-color: var(--color-accent);
}

.wizard__steps :deep(.el-step__head.is-process .el-step__icon) {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-text);
  font-weight: 600;
}

.wizard__steps :deep(.el-step__title.is-process) {
  color: var(--color-text);
  font-weight: 600;
}

.wizard__steps :deep(.el-step__title) {
  font-size: 13px;
  line-height: 1.4;
}

.wizard__heading {
  margin-bottom: var(--space-4);
  font-size: 20px;
  font-weight: 600;
}

.wizard__heading:focus {
  outline: none;
}

.wizard__heading:focus-visible {
  outline: var(--focus-ring);
}

.wizard__counter {
  display: block;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 400;
}

.wizard__footer {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.wizard__footer .el-button + .el-button {
  margin-left: 0;
}
</style>
