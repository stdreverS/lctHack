<script setup lang="ts">
import { DataAnalysis } from '@element-plus/icons-vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <section>
    <h1 class="page__title">Оценка без регистрации</h1>
    <EmptyState title="Мастер оценки в разработке" description="Здесь будет мастер из 8 шагов: объект, параметры, подбор, сравнение, экономика, what-if, симуляция и экспорт. Результаты гостя не сохраняются." :icon="DataAnalysis">
      <el-button type="primary" @click="$router.push('/catalog')">Открыть каталог роботов</el-button>
      <el-button @click="$router.push('/register')">Зарегистрироваться, чтобы сохранять проекты</el-button>
    </EmptyState>
  </section>
</template>
