<script setup lang="ts">
import { Guide } from '@element-plus/icons-vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <section>
    <h1 class="page__title">Платформа подбора роботизированных решений</h1>
    <EmptyState title="Экран приветствия в разработке" description="Здесь будет описание платформы и трёх типов объектов. Уже сейчас можно открыть раздел оценки без регистрации или каталог роботов." :icon="Guide">
      <el-button type="primary" @click="$router.push('/demo')">Попробовать без регистрации</el-button>
      <el-button @click="$router.push('/catalog')">Каталог роботов</el-button>
      <el-button text type="primary" @click="$router.push('/login')">Войти</el-button>
    </EmptyState>
  </section>
</template>
