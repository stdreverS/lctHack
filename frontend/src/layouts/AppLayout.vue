<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLogo from '@/components/common/AppLogo.vue'

const auth = useAuthStore()
const router = useRouter()

function logout() {
  auth.logout()
  void router.push('/')
}
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="topbar__inner">
        <AppLogo />
        <nav class="topbar__nav" aria-label="Рабочая зона">
          <RouterLink to="/app/projects" class="topbar__link">Проекты</RouterLink>
          <RouterLink to="/catalog" class="topbar__link">Каталог</RouterLink>
          <RouterLink to="/app/profile" class="topbar__link">Профиль</RouterLink>
          <RouterLink v-if="auth.isAdmin" to="/admin/robots" class="topbar__link">
            Администрирование
          </RouterLink>
        </nav>
        <div class="topbar__right">
          <span class="topbar__user" :title="auth.user?.email">{{ auth.user?.name }}</span>
          <el-button @click="logout">Выйти</el-button>
        </div>
      </div>
    </header>
    <main class="page">
      <RouterView />
    </main>
  </div>
</template>
