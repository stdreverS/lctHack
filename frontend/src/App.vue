<script setup lang="ts">
import { computed, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'
import { WarningFilled } from '@element-plus/icons-vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAppErrorStore } from '@/stores/appError'
import { describeAppError } from '@/utils/errors'

// Страница упала при отрисовке или её модуль не загрузился (например, сервер недоступен):
// показываем, что случилось и что делать, а не белый экран.
const appError = useAppErrorStore()
const router = useRouter()
const text = computed(() => describeAppError(appError.error))

onErrorCaptured((error) => {
  appError.show(error)
  return false
})

function reload(): void {
  window.location.reload()
}

async function goHome(): Promise<void> {
  appError.clear()
  await router.push('/')
}
</script>

<template>
  <main v-if="appError.error" class="app-error" role="alert">
    <EmptyState :title="text.title" :description="text.description" :icon="WarningFilled">
      <el-button type="primary" @click="reload">Обновить страницу</el-button>
      <el-button @click="goHome">На главную</el-button>
    </EmptyState>
  </main>
  <router-view v-else />
</template>

<style scoped>
.app-error {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-bg);
}
</style>
