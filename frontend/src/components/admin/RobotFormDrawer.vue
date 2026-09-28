<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { Robot } from '@/types/api'
import { createRobot, updateRobot } from '@/api/robots'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import RobotFormField from '@/components/admin/RobotFormField.vue'
import { splitServerErrors } from '@/utils/errors'
import {
  ROBOT_FORM_FIELDS,
  ROBOT_FORM_GROUPS,
  emptyRobotForm,
  formToRobotInput,
  robotToForm,
  serverFieldToFormKey,
  validateRobotForm,
  type RobotFieldKind,
  type RobotForm,
  type RobotFormKey,
} from '@/utils/robotForm'

interface Option {
  value: string
  label: string
}

// Боковая панель создания и редактирования робота (раздел «Управление каталогом»).
const props = defineProps<{
  /** null — новый робот. */
  robot: Robot | null
  objectTypeOptions: Option[]
  solutionTypeOptions: Option[]
}>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [robot: Robot, created: boolean] }>()

/** Поля на всю ширину панели: длинные значения и отметка «подтверждено». */
const WIDE_KINDS: readonly RobotFieldKind[] = ['objectTypes', 'url', 'boolean']
const WIDE_KEYS: readonly RobotFormKey[] = ['name', 'solutionTypeName']

const form = reactive<RobotForm>(emptyRobotForm())
const touched = reactive(new Set<RobotFormKey>())
const submitted = ref(false)
const serverErrors = reactive<Partial<Record<RobotFormKey, string>>>({})
const alertError = ref<unknown>(null)
const saving = ref(false)
const snapshot = ref('')
const alertRef = ref<HTMLElement>()

const title = computed(() => (props.robot ? `Редактирование: ${props.robot.name}` : 'Новый робот'))
const clientErrors = computed(() => validateRobotForm(form))
const dirty = computed(() => JSON.stringify(form) !== snapshot.value)

/** Ошибки проверки видны после ухода с поля или попытки сохранить; ошибки сервера — сразу. */
function errorOf(key: RobotFormKey): string {
  const client = submitted.value || touched.has(key) ? clientErrors.value[key] : undefined
  return serverErrors[key] ?? client ?? ''
}

const inputId = (key: RobotFormKey) => `robot-field-${key}`

function update(key: RobotFormKey, value: RobotForm[RobotFormKey]) {
  ;(form as Record<RobotFormKey, unknown>)[key] = value
  delete serverErrors[key]
  // Существующий тип решения — подставляем его название.
  if (key === 'solutionType') {
    const known = props.solutionTypeOptions.find((o) => o.value === value)
    if (known) {
      form.solutionTypeName = known.label
      delete serverErrors.solutionTypeName
    }
  }
}

watch(open, (value) => {
  if (!value) return
  Object.assign(form, props.robot ? robotToForm(props.robot) : emptyRobotForm())
  snapshot.value = JSON.stringify(form)
  touched.clear()
  submitted.value = false
  for (const key of Object.keys(serverErrors) as RobotFormKey[]) delete serverErrors[key]
  alertError.value = null
})

async function focusFirstError() {
  await nextTick()
  const first = ROBOT_FORM_FIELDS.find((f) => errorOf(f.key))
  if (first) document.getElementById(inputId(first.key))?.focus()
}

async function submit() {
  submitted.value = true
  alertError.value = null
  if (Object.keys(clientErrors.value).length) {
    await focusFirstError()
    return
  }
  saving.value = true
  try {
    const input = formToRobotInput(form)
    const saved = props.robot ? await updateRobot(props.robot.id, input) : await createRobot(input)
    snapshot.value = JSON.stringify(form)
    open.value = false
    emit('saved', saved, !props.robot)
  } catch (error) {
    const paths = ROBOT_FORM_FIELDS.map((f) => f.path)
    const { fieldErrors, showAlert } = splitServerErrors(error, paths)
    for (const [path, message] of Object.entries(fieldErrors)) {
      const key = serverFieldToFormKey(path)
      if (key) serverErrors[key] = message
    }
    alertError.value = showAlert ? error : null
    await nextTick()
    if (showAlert) alertRef.value?.scrollIntoView({ block: 'nearest' })
    else await focusFirstError()
  } finally {
    saving.value = false
  }
}

async function beforeClose(done: () => void) {
  if (saving.value) return
  if (!dirty.value) return done()
  try {
    await ElMessageBox.confirm('Введённые данные не сохранены и будут потеряны.', 'Закрыть без сохранения?', {
      type: 'warning',
      confirmButtonText: 'Закрыть без сохранения',
      cancelButtonText: 'Продолжить редактирование',
    })
    done()
  } catch {
    // остаёмся в форме
  }
}
</script>

<template>
  <el-drawer v-model="open" :title="title" size="560px" :before-close="beforeClose" class="robot-drawer">
    <div ref="alertRef">
      <ErrorAlert :error="alertError" class="robot-drawer__alert" />
    </div>

    <p class="robot-drawer__note">
      Поля со звёздочкой обязательны. Пустая характеристика показывается в каталоге как «нет данных»,
      а при подборе — как непроверенная.
    </p>

    <el-form label-position="top" novalidate @submit.prevent="submit">
      <fieldset v-for="group in ROBOT_FORM_GROUPS" :key="group.key" class="robot-drawer__group">
        <legend class="robot-drawer__legend">{{ group.label }}</legend>
        <div class="robot-drawer__grid">
          <RobotFormField
            v-for="def in group.fields"
            :key="def.key"
            :class="{ 'robot-drawer__wide': WIDE_KINDS.includes(def.kind) || WIDE_KEYS.includes(def.key) }"
            :def="def"
            :value="form[def.key]"
            :error="errorOf(def.key)"
            :input-id="inputId(def.key)"
            :object-type-options="objectTypeOptions"
            :solution-type-options="solutionTypeOptions"
            @update="(v) => update(def.key, v)"
            @blur="touched.add(def.key)"
          />
        </div>
      </fieldset>
      <button type="submit" hidden />
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="beforeClose(() => (open = false))">Отмена</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ robot ? 'Сохранить изменения' : 'Добавить робота' }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.robot-drawer__alert {
  margin-bottom: var(--space-3);
}

.robot-drawer__note {
  margin-bottom: var(--space-4);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.robot-drawer__group {
  min-width: 0; /* у fieldset по умолчанию min-width: min-content — поля распирали бы панель */
  margin: 0 0 var(--space-4);
  padding: 0;
  border: 0;
}

.robot-drawer__legend {
  width: 100%;
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-1);
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.robot-drawer__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--space-4);
}

.robot-drawer__wide {
  grid-column: 1 / -1;
}
</style>
