<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <section>
    <h1 class="page__title">Страница не найдена</h1>
    <EmptyState title="По этому адресу ничего нет" description="Возможно, ссылка устарела или в адресе опечатка. Перейдите на главную или в каталог роботов." :icon="WarningFilled">
      <el-button type="primary" @click="$router.push('/')">На главную</el-button>
      <el-button @click="$router.push('/catalog')">Каталог роботов</el-button>
    </EmptyState>
  </section>
</template>
