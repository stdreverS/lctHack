<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Back, Van } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import AppLogo from '@/components/common/AppLogo.vue'

const auth = useAuthStore()
const route = useRoute()
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
        <span class="admin-badge">Администрирование</span>
        <div class="topbar__right">
          <span class="topbar__user" :title="auth.user?.email">{{ auth.user?.name }}</span>
          <el-button @click="logout">Выйти</el-button>
        </div>
      </div>
    </header>
    <div class="admin">
      <aside class="admin__aside">
        <el-menu :default-active="route.path" router class="admin__menu" aria-label="Разделы администрирования">
          <el-menu-item index="/admin/robots">
            <el-icon><Van /></el-icon>
            <span>Каталог роботов</span>
          </el-menu-item>
          <el-menu-item index="/app/projects">
            <el-icon><Back /></el-icon>
            <span>К рабочей зоне</span>
          </el-menu-item>
        </el-menu>
      </aside>
      <main class="admin__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-badge {
  padding: 2px var(--space-2);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius);
}

.admin {
  display: flex;
  max-width: 1280px;
  margin: 0 auto;
}

.admin__aside {
  flex: 0 0 220px;
  padding: var(--space-5) 0 var(--space-5) var(--space-4);
}

.admin__menu {
  background: transparent;
  border-right: none;
}

.admin__main {
  flex: 1;
  min-width: 0;
  padding: var(--space-5) var(--space-4) var(--space-6);
}
</style>
