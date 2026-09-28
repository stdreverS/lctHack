<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ObjectType, ParamValue, Params } from '@/types/api'
import ParamInput from '@/components/common/ParamInput.vue'
import { validateParams, type ParamIssue } from '@/utils/validateParams'

// Форма параметров объекта, построенная по ObjectType.fields и сгруппированная по groups.
// Ошибка поля показывается после того, как с ним поработали, или после вызова validate().
const props = defineProps<{
  fields: ObjectType['fields']
  groups: ObjectType['groups']
  /** Префикс id полей — чтобы на странице не было одинаковых id. */
  idPrefix?: string
}>()

const model = defineModel<Params>({ required: true })

const OTHER_GROUP = { key: '__other', label: 'Прочие параметры' }

const touched = ref(new Set<string>())
const showAll = ref(false)

const errors = computed<ParamIssue[]>(() => validateParams(props.fields, model.value))
const errorByKey = computed(() => new Map(errors.value.map((e) => [e.key, e.message])))

const sections = computed(() => {
  const known = new Set(props.groups.map((g) => g.key))
  const list = [...props.groups, OTHER_GROUP].map((g) => ({
    ...g,
    fields: props.fields.filter((f) => (known.has(f.group) ? f.group === g.key : g.key === OTHER_GROUP.key)),
  }))
  return list.filter((g) => g.fields.length > 0)
})

// Новый набор полей (другой тип объекта) — проверка начинается заново.
watch(
  () => props.fields,
  () => {
    touched.value = new Set()
    showAll.value = false
  },
)

function inputId(key: string): string {
  return `${props.idPrefix ?? 'param'}-${key}`
}

function shownError(key: string): string {
  return showAll.value || touched.value.has(key) ? (errorByKey.value.get(key) ?? '') : ''
}

function touch(key: string) {
  if (!touched.value.has(key)) touched.value = new Set(touched.value).add(key)
}

function update(key: string, value: ParamValue) {
  model.value = { ...model.value, [key]: value }
  touch(key)
}

/** Показывает все ошибки и возвращает их список (пустой — форма валидна). */
function validate(): ParamIssue[] {
  showAll.value = true
  return errors.value
}

/** Прокручивает к полю и ставит в него фокус. */
async function focusField(key: string) {
  await nextTick()
  const el = document.getElementById(inputId(key))
  el?.scrollIntoView({ block: 'center' })
  const target = el?.matches('input, button, [tabindex]') ? el : el?.querySelector<HTMLElement>('input, [tabindex]')
  target?.focus({ preventScroll: true })
}

defineExpose({ validate, errors, focusField })
</script>

<template>
  <el-form label-position="top" class="dynamic-form" @submit.prevent>
    <fieldset v-for="section in sections" :key="section.key" class="dynamic-form__group">
      <legend class="dynamic-form__legend">{{ section.label }}</legend>
      <div class="dynamic-form__grid">
        <ParamInput
          v-for="field in section.fields"
          :key="field.key"
          :field="field"
          :value="model[field.key]"
          :error="shownError(field.key)"
          :input-id="inputId(field.key)"
          @update="(v) => update(field.key, v)"
          @blur="touch(field.key)"
        />
      </div>
    </fieldset>
  </el-form>
</template>

<style scoped>
.dynamic-form {
  display: grid;
  gap: var(--space-4);
}

.dynamic-form__group {
  min-width: 0;
  margin: 0;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.dynamic-form__legend {
  float: left;
  width: 100%;
  margin-bottom: var(--space-3);
  padding: 0;
  font-size: 16px;
  font-weight: 600;
}

.dynamic-form__grid {
  clear: both;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  column-gap: var(--space-5);
}
</style>
