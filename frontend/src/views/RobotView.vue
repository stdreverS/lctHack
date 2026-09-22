<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getObjectTypes } from '@/api/objectTypes'
import { getRobot } from '@/api/robots'
import type { ObjectType, Robot } from '@/types/api'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import SourceBadge from '@/components/common/SourceBadge.vue'
import { NO_DATA, ROBOT_SPEC_GROUPS, type SpecContext } from '@/utils/robotSpecs'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const robot = ref<Robot | null>(null)
const objectTypes = ref<ObjectType[]>([])
const loading = ref(false)
const error = ref<unknown>(null)
let requestSeq = 0

const robotId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))

const ctx = computed<SpecContext>(() => ({
  objectTypeNames: Object.fromEntries(objectTypes.value.map((t) => [t.code, t.name])),
}))

// Качество данных показываем отдельным блоком (ссылка, дата, статус), остальное — таблицами.
const groups = computed(() => ROBOT_SPEC_GROUPS.filter((g) => g.key !== 'quality'))

async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = null
  robot.value = null
  try {
    const [r, types] = await Promise.all([
      getRobot(robotId.value),
      objectTypes.value.length ? Promise.resolve(objectTypes.value) : getObjectTypes(),
    ])
    if (seq !== requestSeq) return
    robot.value = r
    objectTypes.value = types
    document.title = `${r.name} — Каталог роботов`
  } catch (e) {
    if (seq === requestSeq) error.value = e
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

watch(robotId, (id) => id && load(), { immediate: true })

/** Назад в каталог с сохранёнными фильтрами, если пришли из него; иначе — просто в каталог. */
function backToCatalog() {
  const back = (window.history.state as { back?: unknown } | null)?.back
  if (typeof back === 'string' && back.startsWith('/catalog') && !back.startsWith('/catalog/')) {
    router.back()
  } else {
    void router.push({ name: 'catalog' })
  }
}
</script>

<template>
  <section class="robot">
    <el-button link :icon="ArrowLeft" class="robot__back" @click="backToCatalog">Каталог роботов</el-button>

    <template v-if="error">
      <h1 class="page__title">Карточка робота</h1>
      <ErrorAlert :error="error" retry @retry="load" />
    </template>

    <div v-else-if="loading || !robot" class="robot__skeleton" aria-busy="true" aria-label="Загрузка карточки">
      <el-skeleton :rows="1" animated />
      <el-skeleton v-for="n in 3" :key="n" :rows="4" animated />
    </div>

    <template v-else>
      <header class="robot__header">
        <div>
          <h1 class="page__title robot__title">{{ robot.name }}</h1>
          <p class="robot__subtitle">{{ robot.manufacturer }} · {{ robot.solutionTypeName }}</p>
        </div>
        <SourceBadge :confirmed="robot.confirmed" :source="robot.sourceUrl" :date="robot.sourceDate" />
      </header>

      <div class="robot__grid">
        <section v-for="group in groups" :key="group.key" class="robot__card" :aria-labelledby="`g-${group.key}`">
          <h2 :id="`g-${group.key}`" class="robot__card-title">{{ group.label }}</h2>
          <dl class="robot__list">
            <div v-for="row in group.rows" :key="row.key" class="robot__row">
              <dt>{{ row.label }}</dt>
              <dd :class="{ 'no-data': row.value(robot, ctx) === NO_DATA }">{{ row.value(robot, ctx) }}</dd>
            </div>
          </dl>
        </section>

        <section class="robot__card" aria-labelledby="g-quality">
          <h2 id="g-quality" class="robot__card-title">Качество данных</h2>
          <dl class="robot__list">
            <div class="robot__row">
              <dt>Статус данных</dt>
              <dd><SourceBadge :confirmed="robot.confirmed" :source="robot.sourceUrl" :date="robot.sourceDate" /></dd>
            </div>
            <div class="robot__row">
              <dt>Источник</dt>
              <dd v-if="robot.sourceUrl" class="robot__source">
                <a :href="robot.sourceUrl" target="_blank" rel="noopener noreferrer">{{ robot.sourceUrl }}</a>
              </dd>
              <dd v-else class="no-data">{{ NO_DATA }}</dd>
            </div>
            <div class="robot__row">
              <dt>Дата данных</dt>
              <dd :class="{ 'no-data': !robot.sourceDate }">
                {{ robot.sourceDate ? formatDate(robot.sourceDate) : NO_DATA }}
              </dd>
            </div>
          </dl>
          <p v-if="!robot.confirmed" class="robot__note">
            Характеристики не подтверждены источником и используются в расчётах как допущение.
            Перед закупкой уточните их у производителя.
          </p>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.robot__back {
  margin-bottom: var(--space-3);
}

.robot__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.robot__title {
  margin-bottom: var(--space-1);
}

.robot__subtitle {
  color: var(--color-text-secondary);
}

.robot__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: var(--space-4);
}

.robot__card,
.robot__skeleton > * {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.robot__skeleton {
  display: grid;
  gap: var(--space-4);
}

.robot__card-title {
  margin-bottom: var(--space-2);
  font-size: 16px;
  font-weight: 600;
}

.robot__row {
  display: grid;
  grid-template-columns: minmax(140px, 45%) 1fr;
  gap: var(--space-3);
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.robot__row:last-child {
  border-bottom: none;
}

.robot__row dt {
  color: var(--color-text-secondary);
}

.robot__row dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.robot__source {
  overflow-wrap: anywhere;
}

.no-data {
  color: var(--color-text-secondary);
}

.robot__note {
  margin-top: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 13px;
}

@media (max-width: 480px) {
  .robot__grid {
    grid-template-columns: 1fr;
  }
}
</style>
