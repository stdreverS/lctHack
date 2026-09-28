<script setup lang="ts">
import { useWizardStore } from '@/stores/wizard'
import { useAuthStore } from '@/stores/auth'
import WizardShell from '@/components/wizard/WizardShell.vue'

const wizard = useWizardStore()
const auth = useAuthStore()

// Синхронно, до первого рендера мастера: шаги не должны увидеть данные чужого проекта.
wizard.startGuest()
</script>

<template>
  <section>
    <h1 class="page__title">Оценка без регистрации</h1>
    <p class="demo__note">
      Результаты гостевой оценки не сохраняются и пропадут после перезагрузки страницы.
      <template v-if="auth.isLoggedIn">
        Чтобы сохранить работу, создайте проект в разделе
        <RouterLink :to="{ name: 'projects' }">«Мои проекты»</RouterLink>.
      </template>
      <template v-else>
        Чтобы сохранять проекты и историю расчётов,
        <RouterLink :to="{ name: 'register' }">зарегистрируйтесь</RouterLink>.
      </template>
    </p>
    <WizardShell />
  </section>
</template>

<style scoped>
.demo__note {
  margin: calc(-1 * var(--space-2)) 0 var(--space-4);
  color: var(--color-text-secondary);
}
</style>
