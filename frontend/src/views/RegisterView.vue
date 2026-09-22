<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { splitServerErrors } from '@/utils/errors'
import { safeRedirect } from '@/utils/redirect'
import ErrorAlert from '@/components/common/ErrorAlert.vue'

const FIELDS = ['name', 'email', 'password'] as const
type Field = (typeof FIELDS)[number]
const MIN_PASSWORD = 8

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const formRef = ref<FormInstance>()
const form = reactive<Record<Field, string>>({ name: '', email: '', password: '' })
const serverErrors = reactive<Record<Field, string>>({ name: '', email: '', password: '' })
const alertError = ref<unknown>(null)
const loading = ref(false)

const rules: FormRules<typeof form> = {
  name: [{ required: true, whitespace: true, message: 'Укажите имя', trigger: 'blur' }],
  email: [
    { required: true, message: 'Введите почту', trigger: 'blur' },
    { type: 'email', message: 'Введите почту в формате name@company.ru', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Придумайте пароль', trigger: 'blur' },
    { min: MIN_PASSWORD, message: `Пароль должен быть не короче ${MIN_PASSWORD} символов`, trigger: 'blur' },
  ],
}

for (const field of FIELDS) {
  watch(() => form[field], () => (serverErrors[field] = ''))
}

function clearServerErrors() {
  alertError.value = null
  for (const field of FIELDS) serverErrors[field] = ''
}

async function submit() {
  clearServerErrors()
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await auth.register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    const { fieldErrors, showAlert } = splitServerErrors(error, FIELDS)
    Object.assign(serverErrors, fieldErrors)
    alertError.value = showAlert ? error : null
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth-card">
    <h1 class="page__title">Регистрация</h1>

    <ErrorAlert :error="alertError" class="auth-card__alert" />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
      <el-form-item label="Имя" prop="name" :error="serverErrors.name">
        <el-input v-model="form.name" name="name" autocomplete="name" placeholder="Ирина Смирнова" />
        <div class="form-hint">Будет показано в шапке и в отчётах</div>
      </el-form-item>

      <el-form-item label="Почта" prop="email" :error="serverErrors.email">
        <el-input
          v-model="form.email"
          name="email"
          inputmode="email"
          autocomplete="email"
          placeholder="ivanov@company.ru"
        />
        <div class="form-hint">Рабочая почта — она будет логином</div>
      </el-form-item>

      <el-form-item label="Пароль" prop="password" :error="serverErrors.password">
        <el-input
          v-model="form.password"
          name="password"
          type="password"
          show-password
          autocomplete="new-password"
          placeholder="Например: Sklad2026"
        />
        <div class="form-hint">Не короче {{ MIN_PASSWORD }} символов, лучше с буквами и цифрами</div>
      </el-form-item>

      <el-button type="primary" native-type="submit" :loading="loading" class="auth-card__submit">
        Зарегистрироваться
      </el-button>
    </el-form>

    <p class="auth-card__footer">
      Уже есть учётная запись?
      <RouterLink :to="{ path: '/login', query: route.query }">Войти</RouterLink>
    </p>
  </section>
</template>
