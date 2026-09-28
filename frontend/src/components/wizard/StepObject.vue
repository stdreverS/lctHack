<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useWizardStore, type FillMode } from '@/stores/wizard'
import ErrorAlert from '@/components/common/ErrorAlert.vue'

const FILL_MODES: { value: FillMode; title: string; text: string }[] = [
  { value: 'demo', title: 'Демо-данные', text: 'Типовой объект с заполненными параметрами — чтобы быстро увидеть результат.' },
  { value: 'manual', title: 'Заполнить вручную', text: 'Введите параметры своего объекта. Нормативные значения подставятся сами.' },
  { value: 'csv', title: 'Загрузить CSV', text: 'Скачайте шаблон, заполните его в Excel и загрузите на шаге «Параметры».' },
]

const wizard = useWizardStore()

const loading = ref(false)
const error = ref<unknown>(null)
const attempted = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    await wizard.loadObjectTypes()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!wizard.objectTypes.length) void load()
})

const processes = computed({
  get: () => wizard.processes,
  set: (codes: string[]) => wizard.setProcesses(codes),
})

const hasEnteredParams = computed(() => Object.values(wizard.params).some((v) => v !== null && v !== ''))

async function confirmReplace(message: string, title: string, button: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, { type: 'warning', confirmButtonText: button, cancelButtonText: 'Отмена' })
    return true
  } catch {
    return false
  }
}

async function selectType(code: string) {
  if (code === wizard.objectType) return
  if (hasEnteredParams.value) {
    const ok = await confirmReplace(
      'Введённые параметры относятся к текущему типу объекта и будут сброшены.',
      'Сменить тип объекта?',
      'Сменить тип',
    )
    if (!ok) return
  }
  wizard.selectObjectType(code)
}

async function selectFillMode(mode: FillMode) {
  if (mode === wizard.fillMode) return
  if (mode === 'demo' && hasEnteredParams.value && wizard.fillMode !== null) {
    const ok = await confirmReplace(
      'Все введённые параметры будут заменены демо-данными типового объекта.',
      'Подставить демо-данные?',
      'Заменить',
    )
    if (!ok) return
  }
  wizard.chooseFillMode(mode)
}

const missing = computed(() => ({
  type: !wizard.objectType,
  processes: wizard.processes.length === 0,
  fill: wizard.fillMode === null,
}))

function validate(): boolean {
  attempted.value = true
  return !missing.value.type && !missing.value.processes && !missing.value.fill
}

defineExpose({ validate })
</script>

<template>
  <div class="step-object">
    <ErrorAlert v-if="error" :error="error" retry @retry="load" />
    <el-skeleton v-else-if="loading" :rows="4" animated />

    <template v-else>
      <section aria-labelledby="so-type">
        <h3 id="so-type" class="step-object__title">Тип объекта</h3>
        <div class="step-object__cards" role="group" aria-labelledby="so-type">
          <button
            v-for="t in wizard.objectTypes"
            :key="t.code"
            type="button"
            class="option-card"
            :class="{ 'is-selected': wizard.objectType === t.code }"
            :aria-pressed="wizard.objectType === t.code"
            @click="selectType(t.code)"
          >
            <span class="option-card__title">{{ t.name }}</span>
            <span class="option-card__text">{{ t.description }}</span>
            <span class="option-card__meta">
              Процессов: {{ t.processes.length }} ·
              {{ t.layout ? '2D-симуляция доступна' : '2D-симуляция пока недоступна' }}
            </span>
          </button>
        </div>
        <p v-if="attempted && missing.type" class="step-object__error" role="alert">
          Выберите тип объекта — от него зависят параметры и подходящие роботы.
        </p>
      </section>

      <template v-if="wizard.currentType">
        <section aria-labelledby="so-proc">
          <h3 id="so-proc" class="step-object__title">Процессы для роботизации</h3>
          <el-checkbox-group v-model="processes" aria-labelledby="so-proc" class="step-object__processes">
            <el-checkbox v-for="p in wizard.currentType.processes" :key="p.code" :value="p.code" border>
              {{ p.name }}
            </el-checkbox>
          </el-checkbox-group>
          <p v-if="attempted && missing.processes" class="step-object__error" role="alert">
            Отметьте хотя бы один процесс, который хотите роботизировать.
          </p>
        </section>

        <section aria-labelledby="so-fill">
          <h3 id="so-fill" class="step-object__title">Как заполнить параметры объекта</h3>
          <div class="step-object__cards step-object__cards--fill" role="group" aria-labelledby="so-fill">
            <button
              v-for="m in FILL_MODES"
              :key="m.value"
              type="button"
              class="option-card"
              :class="{ 'is-selected': wizard.fillMode === m.value }"
              :aria-pressed="wizard.fillMode === m.value"
              @click="selectFillMode(m.value)"
            >
              <span class="option-card__title">{{ m.title }}</span>
              <span class="option-card__text">{{ m.text }}</span>
            </button>
          </div>
          <p v-if="attempted && missing.fill" class="step-object__error" role="alert">
            Выберите способ заполнения параметров.
          </p>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.step-object {
  display: grid;
  gap: var(--space-5);
}

.step-object__title {
  margin-bottom: var(--space-2);
  font-size: 16px;
  font-weight: 600;
}

.step-object__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-3);
}

.option-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
}

.option-card:hover {
  border-color: var(--color-primary);
}

.option-card.is-selected {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
  background: var(--el-color-primary-light-9);
}

.option-card__title {
  font-weight: 600;
}

.option-card__text {
  color: var(--color-text-secondary);
}

.option-card__meta {
  margin-top: auto;
  padding-top: var(--space-1);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.step-object__processes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.step-object__processes .el-checkbox {
  margin-right: 0;
}

.step-object__error {
  margin-top: var(--space-2);
  color: var(--color-danger);
}
</style>
