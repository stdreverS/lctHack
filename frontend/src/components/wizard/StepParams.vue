<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Params } from '@/types/api'
import { useWizardStore } from '@/stores/wizard'
import DynamicForm from '@/components/common/DynamicForm.vue'
import CsvImportPanel from '@/components/wizard/CsvImportPanel.vue'
import type { ParamIssue } from '@/utils/validateParams'

const wizard = useWizardStore()

const formRef = ref<InstanceType<typeof DynamicForm>>()
/** Список ошибок после попытки перейти дальше; обновляется вместе с формой. */
const attempted = ref(false)
const summaryRef = ref<HTMLElement>()

const params = computed({
  get: () => wizard.params,
  set: (value: Params) => wizard.setParams(value),
})

const issues = computed<ParamIssue[]>(() => (attempted.value ? wizard.paramIssues : []))

function onImport(patch: Params) {
  wizard.mergeParams(patch)
}

async function validate(): Promise<boolean> {
  const list = formRef.value?.validate() ?? []
  attempted.value = true
  if (list.length === 0) return true
  await nextTick()
  summaryRef.value?.focus()
  return false
}

defineExpose({ validate })
</script>

<template>
  <div v-if="wizard.currentType" class="step-params">
    <p class="step-params__intro">
      Параметры объекта «{{ wizard.currentType.name }}». Поля со звёздочкой обязательны.
      Наведите на <span aria-hidden="true">ⓘ</span> у названия поля, чтобы увидеть подсказку.
    </p>

    <CsvImportPanel :type="wizard.currentType" :prominent="wizard.fillMode === 'csv'" @import="onImport" />

    <div
      v-if="issues.length"
      ref="summaryRef"
      class="step-params__summary"
      tabindex="-1"
      role="alert"
    >
      <p class="step-params__summary-title">
        Исправьте поля ({{ issues.length }}), чтобы перейти к подбору роботов:
      </p>
      <ul>
        <li v-for="issue in issues" :key="issue.key">
          <el-button link type="danger" @click="formRef?.focusField(issue.key)">{{ issue.label }}</el-button>
          — {{ issue.message }}
        </li>
      </ul>
    </div>

    <DynamicForm
      ref="formRef"
      v-model="params"
      :fields="wizard.currentType.fields"
      :groups="wizard.currentType.groups"
      id-prefix="wizard-param"
    />
  </div>
  <p v-else class="step-params__intro">Сначала выберите тип объекта на шаге «Объект».</p>
</template>

<style scoped>
.step-params {
  display: grid;
  gap: var(--space-4);
}

.step-params__intro {
  color: var(--color-text-secondary);
}

.step-params__summary {
  padding: var(--space-3) var(--space-4);
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
}

.step-params__summary:focus-visible {
  outline: var(--focus-ring);
}

.step-params__summary-title {
  margin-bottom: var(--space-1);
  font-weight: 600;
}

.step-params__summary ul {
  padding-left: var(--space-4);
  list-style: disc;
}

.step-params__summary .el-button {
  height: auto;
  padding: 0;
  vertical-align: baseline;
}
</style>
