<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { USE_MOCKS } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { splitServerErrors } from '@/utils/errors'
import { safeRedirect } from '@/utils/redirect'
import ErrorAlert from '@/components/common/ErrorAlert.vue'

const FIELDS = ['email', 'password'] as const
type Field = (typeof FIELDS)[number]

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const formRef = ref<FormInstance>()
const form = reactive<Record<Field, string>>({ email: '', password: '' })
const serverErrors = reactive<Record<Field, string>>({ email: '', password: '' })
const alertError = ref<unknown>(null)
const loading = ref(false)

const rules: FormRules<typeof form> = {
  email: [
    { required: true, message: 'Введите почту', trigger: 'blur' },
    { type: 'email', message: 'Введите почту в формате name@company.ru', trigger: 'blur' },
  ],
  password: [{ required: true, message: 'Введите пароль', trigger: 'blur' }],
}

// Ошибка сервера у поля исчезает, как только пользователь начинает его исправлять
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
    await auth.login({ email: form.email.trim(), password: form.password })
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    const { fieldErrors, showAlert } = splitServerErrors(error, FIELDS)
    Object.assign(serverErrors, fieldErrors)
    alertError.value = showAlert ? error : null
  } finally {
    loading.value = false
  }
}

function fillDemo(email: string, password: string) {
  form.email = email
  form.password = password
}
</script>

<template>
  <section class="auth-card">
    <h1 class="page__title">Вход</h1>

    <ErrorAlert :error="alertError" class="auth-card__alert" />

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
      <el-form-item label="Почта" prop="email" :error="serverErrors.email">
        <el-input
          v-model="form.email"
          name="email"
          inputmode="email"
          autocomplete="email"
          placeholder="ivanov@company.ru"
        />
        <div class="form-hint">Почта, указанная при регистрации</div>
      </el-form-item>

      <el-form-item label="Пароль" prop="password" :error="serverErrors.password">
        <el-input
          v-model="form.password"
          name="password"
          type="password"
          show-password
          autocomplete="current-password"
          placeholder="Не короче 8 символов"
        />
        <div class="form-hint">Учитывается регистр букв</div>
      </el-form-item>

      <el-button type="primary" native-type="submit" :loading="loading" class="auth-card__submit">
        Войти
      </el-button>
    </el-form>

    <p class="auth-card__footer">
      Нет учётной записи?
      <RouterLink :to="{ path: '/register', query: route.query }">Зарегистрироваться</RouterLink>
    </p>

    <div v-if="USE_MOCKS" class="demo-access">
      <p class="demo-access__title">Демо-доступ (режим моков)</p>
      <el-button size="small" @click="fillDemo('user@demo.ru', 'Demo12345')">Пользователь</el-button>
      <el-button size="small" @click="fillDemo('admin@demo.ru', 'Admin12345')">Администратор</el-button>
    </div>
  </section>
</template>

<style scoped>
.demo-access {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  text-align: center;
  border-top: 1px solid var(--color-border);
}

.demo-access__title {
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>
