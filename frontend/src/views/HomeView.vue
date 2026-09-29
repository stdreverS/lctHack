<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWizardStore } from '@/stores/wizard'
import ErrorAlert from '@/components/common/ErrorAlert.vue'

// Главная: что делает платформа, для кого, три типа объектов, путь из 8 шагов.
const auth = useAuthStore()
const wizard = useWizardStore()

const AUDIENCE = [
  { title: 'Руководители предприятий', text: 'Быстро понять, окупится ли роботизация и в какие сроки.' },
  { title: 'Технические директора', text: 'Сравнить решения по характеристикам и требованиям к инфраструктуре.' },
  { title: 'Логисты и руководители автоматизации', text: 'Оценить число роботов и проверить поток на схеме объекта.' },
  { title: 'Финансовые аналитики', text: 'Увидеть CAPEX, OPEX, ROI, формулы и допущения расчёта.' },
]

const STEPS = [
  { title: 'Объект', text: 'Тип объекта и процессы для роботизации' },
  { title: 'Параметры', text: 'Ручной ввод, демо-данные или загрузка CSV' },
  { title: 'Подбор', text: 'Подходящие роботы и причины исключения' },
  { title: 'Сравнение', text: 'Характеристики выбранных решений рядом' },
  { title: 'Экономика', text: 'Без роботов, покупка и аренда: окупаемость, ROI, ТСО' },
  { title: 'What-if', text: 'Как меняется результат при других допущениях' },
  { title: 'Симуляция', text: 'Работа парка на 2D-схеме объекта' },
  { title: 'Экспорт', text: 'Итоговая таблица, отчёт и схема' },
]

const loading = ref(false)
const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    await wizard.loadObjectTypes()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!wizard.objectTypes.length) void load()
})
</script>

<template>
  <div class="home">
    <section class="home__intro" aria-labelledby="home-title">
      <h1 id="home-title" class="home__title">Платформа подбора роботизированных решений</h1>
      <p class="home__lead">
        Экспресс-предынвестиционная оценка роботизации объекта: подбор роботов под параметры
        объекта, сравнение вариантов, экономика трёх сценариев и проверка расчёта на 2D-схеме.
        Результат — обоснованная гипотеза для перехода к технико-экономическому обоснованию.
      </p>
      <div class="home__actions">
        <el-button type="primary" size="large" @click="$router.push('/demo')">Попробовать без регистрации</el-button>
        <el-button size="large" @click="$router.push('/catalog')">Каталог роботов</el-button>
        <el-button v-if="auth.isLoggedIn" text type="primary" size="large" @click="$router.push('/app/projects')">
          Мои проекты
        </el-button>
        <el-button v-else text type="primary" size="large" @click="$router.push('/login')">Войти</el-button>
      </div>
      <p class="home__note">
        Оценка предварительная и требует верификации при обследовании объекта.
      </p>
    </section>

    <section class="home__section" aria-labelledby="home-types">
      <h2 id="home-types" class="home__heading">Типы объектов</h2>
      <el-skeleton v-if="loading && !wizard.objectTypes.length" :rows="3" animated aria-label="Загрузка типов объектов" />
      <ErrorAlert v-else-if="error" :error="error" retry @retry="load" />
      <ul v-else class="home__types">
        <li v-for="t in wizard.objectTypes" :key="t.code" class="home__card">
          <h3 class="home__card-title">{{ t.name }}</h3>
          <p class="home__card-text">{{ t.description }}</p>
          <p class="home__card-label">Процессы</p>
          <ul class="home__processes">
            <li v-for="p in t.processes" :key="p.code">{{ p.name }}</li>
          </ul>
          <p class="home__card-meta">
            Параметров: {{ t.fields.length }} ·
            {{ t.layout ? '2D-симуляция доступна' : '2D-симуляция пока недоступна' }}
          </p>
        </li>
      </ul>
    </section>

    <section class="home__section" aria-labelledby="home-audience">
      <h2 id="home-audience" class="home__heading">Для кого</h2>
      <ul class="home__audience">
        <li v-for="a in AUDIENCE" :key="a.title" class="home__audience-item">
          <p class="home__audience-title">{{ a.title }}</p>
          <p class="home__card-text">{{ a.text }}</p>
        </li>
      </ul>
    </section>

    <section class="home__section" aria-labelledby="home-steps">
      <h2 id="home-steps" class="home__heading">Путь оценки: 8 шагов</h2>
      <ol class="home__steps">
        <li v-for="(s, i) in STEPS" :key="s.title" class="home__step">
          <span class="home__step-num num" aria-hidden="true">{{ i + 1 }}</span>
          <span>
            <span class="home__step-title">{{ s.title }}</span>
            <span class="home__step-text">{{ s.text }}</span>
          </span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: var(--space-6);
}

.home__intro {
  padding: var(--space-6) var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius);
}

.home__title {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.25;
}

.home__lead {
  max-width: 760px;
  margin-top: var(--space-3);
  font-size: 16px;
}

.home__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin-top: var(--space-5);
}

.home__actions .el-button + .el-button {
  margin-left: 0;
}

.home__note {
  margin-top: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.home__section {
  display: grid;
  gap: var(--space-3);
}

.home__heading {
  font-size: 18px;
  font-weight: 600;
}

.home__types,
.home__audience {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}

.home__card,
.home__audience-item {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.home__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.home__card-title,
.home__audience-title {
  font-size: 15px;
  font-weight: 600;
}

.home__card-text {
  color: var(--color-text-secondary);
}

.home__card-label {
  margin-top: var(--space-1);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.home__processes {
  padding-left: var(--space-4);
  list-style: disc;
}

.home__card-meta {
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.home__steps {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-2) var(--space-4);
}

.home__step {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.home__step-num {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-primary);
  border-radius: 50%;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.home__step-title {
  display: block;
  font-weight: 600;
}

.home__step-text {
  display: block;
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
