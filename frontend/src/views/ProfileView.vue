<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Role } from '@/types/api'
import { useAuthStore } from '@/stores/auth'

const ROLE_LABELS: Record<Role, string> = {
  user: 'Пользователь',
  admin: 'Администратор',
}

const auth = useAuthStore()
const router = useRouter()

const user = computed(() => auth.user)

function logout() {
  auth.logout()
  void router.push('/')
}
</script>

<template>
  <section class="profile">
    <h1 class="page__title">Профиль</h1>

    <div v-if="user" class="profile__card">
      <dl class="profile__list">
        <div class="profile__row">
          <dt>Имя</dt>
          <dd>{{ user.name }}</dd>
        </div>
        <div class="profile__row">
          <dt>Почта</dt>
          <dd class="profile__email">{{ user.email }}</dd>
        </div>
        <div class="profile__row">
          <dt>Роль</dt>
          <dd>
            {{ ROLE_LABELS[user.role] }}
            <span v-if="user.role === 'admin'" class="profile__note">— доступно управление каталогом роботов</span>
          </dd>
        </div>
      </dl>
      <el-button class="profile__logout" @click="logout">Выйти</el-button>
    </div>
  </section>
</template>

<style scoped>
.profile__card {
  max-width: 560px;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.profile__row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: var(--space-3);
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.profile__row:last-child {
  border-bottom: none;
}

.profile__row dt {
  color: var(--color-text-secondary);
}

.profile__row dd {
  margin: 0;
}

.profile__email {
  overflow-wrap: anywhere;
}

.profile__note {
  color: var(--color-text-secondary);
}

.profile__logout {
  margin-top: var(--space-4);
}
</style>
