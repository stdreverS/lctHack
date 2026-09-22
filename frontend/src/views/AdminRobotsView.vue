<script setup lang="ts">
import { Van } from '@element-plus/icons-vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <section>
    <h1 class="page__title">Управление каталогом</h1>
    <EmptyState title="Управление каталогом в разработке" description="Здесь будет таблица роботов с формой добавления, редактирования и удаления." :icon="Van">
      <el-button @click="$router.push('/catalog')">Открыть публичный каталог</el-button>
    </EmptyState>
  </section>
</template>
