<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AppLogo from '@/components/common/AppLogo.vue'

const auth = useAuthStore()
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="topbar__inner">
        <AppLogo />
        <nav class="topbar__nav" aria-label="Основная навигация">
          <RouterLink to="/catalog" class="topbar__link">Каталог</RouterLink>
          <RouterLink to="/demo" class="topbar__link">Попробовать</RouterLink>
        </nav>
        <div class="topbar__right">
          <el-button v-if="auth.isLoggedIn" type="primary" @click="$router.push('/app/projects')">
            Мои проекты
          </el-button>
          <template v-else>
            <el-button text @click="$router.push('/login')">Войти</el-button>
            <el-button type="primary" plain @click="$router.push('/register')">Регистрация</el-button>
          </template>
        </div>
      </div>
    </header>
    <main class="page">
      <RouterView />
    </main>
  </div>
</template>
