<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { createProject } from '@/api/projects'
import type { ObjectType, Project } from '@/types/api'
import { splitServerErrors } from '@/utils/errors'
import { newProjectInput } from '@/utils/projects'
import ErrorAlert from '@/components/common/ErrorAlert.vue'

const FIELDS = ['name', 'objectType'] as const
type Field = (typeof FIELDS)[number]

const props = defineProps<{ objectTypes: ObjectType[] }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ created: [project: Project] }>()

const formRef = ref<FormInstance>()
const form = reactive<Record<Field, string>>({ name: '', objectType: '' })
const serverErrors = reactive<Record<Field, string>>({ name: '', objectType: '' })
const alertError = ref<unknown>(null)
const saving = ref(false)

const rules: FormRules<typeof form> = {
  name: [{ required: true, whitespace: true, message: 'Укажите название проекта', trigger: 'blur' }],
  objectType: [{ required: true, message: 'Выберите тип объекта', trigger: 'change' }],
}

const selectedType = computed(() => props.objectTypes.find((t) => t.code === form.objectType) ?? null)

for (const field of FIELDS) {
  watch(() => form[field], () => (serverErrors[field] = ''))
}

// Каждое открытие — чистая форма; первый тип объекта выбран заранее.
watch(open, (value) => {
  if (!value) return
  form.name = ''
  form.objectType = props.objectTypes[0]?.code ?? ''
  alertError.value = null
  for (const field of FIELDS) serverErrors[field] = ''
  formRef.value?.clearValidate()
})

async function submit() {
  alertError.value = null
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !selectedType.value) return
  saving.value = true
  try {
    const project = await createProject(newProjectInput(form.name, selectedType.value))
    open.value = false
    emit('created', project)
  } catch (error) {
    const { fieldErrors, showAlert } = splitServerErrors(error, FIELDS)
    Object.assign(serverErrors, fieldErrors)
    alertError.value = showAlert ? error : null
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="open" title="Новый проект" width="520px" :close-on-click-modal="!saving">
    <ErrorAlert :error="alertError" class="new-project__alert" />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
      <el-form-item label="Название проекта" prop="name" :error="serverErrors.name">
        <el-input v-model="form.name" name="name" maxlength="200" placeholder="Склад «Химки» — роботизация приёмки" />
        <div class="form-hint">Объект и цель оценки — так проект будет проще найти в списке</div>
      </el-form-item>

      <el-form-item label="Тип объекта" prop="objectType" :error="serverErrors.objectType">
        <el-select v-model="form.objectType" placeholder="Выберите тип объекта" class="new-project__select">
          <el-option v-for="t in objectTypes" :key="t.code" :value="t.code" :label="t.name" />
        </el-select>
        <div class="form-hint">
          {{ selectedType?.description ?? 'От типа зависят параметры объекта и подходящие роботы' }}
        </div>
      </el-form-item>
      <p class="new-project__note">
        Параметры объекта заполнятся типовыми значениями — их можно изменить в мастере.
      </p>
      <!-- Enter в поле названия отправляет форму -->
      <button type="submit" hidden />
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="open = false">Отмена</el-button>
      <el-button type="primary" :loading="saving" @click="submit">Создать проект</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.new-project__alert {
  margin-bottom: var(--space-4);
}

.new-project__select {
  width: 100%;
}

.new-project__note {
  color: var(--color-text-secondary);
  font-size: 13px;
}

:deep(.el-form-item__content) {
  flex-direction: column;
  align-items: stretch;
}
</style>
