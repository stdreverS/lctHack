<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Histogram, Loading } from '@element-plus/icons-vue'
import { useWizardStore } from '@/stores/wizard'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorAlert from '@/components/common/ErrorAlert.vue'
import SimulationCanvas from '@/components/sim/SimulationCanvas.vue'
import SimControls from '@/components/sim/SimControls.vue'
import SimKpiPanel from '@/components/sim/SimKpiPanel.vue'
import SimLegend from '@/components/sim/SimLegend.vue'
import { buildTimeline } from '@/sim/renderer'
import { SIM_HOURS, buildSimInput } from '@/utils/simInput'
import { saveBlob } from '@/utils/download'

// Шаг 7: прогон модели по выбранному сценарию и проверка расчёта.
const wizard = useWizardStore()

const hasScenarios = computed(() =>
  ['purchase', 'raas'].every((kind) => wizard.scenarios.some((s) => s.kind === kind && s.robotId)),
)
const layout = computed(() => wizard.currentType?.layout ?? null)
const objectName = computed(() => wizard.currentType?.name ?? 'этого типа объекта')

const scenarioOptions = computed(() => (wizard.result?.scenarios ?? []).filter((s) => s.kind !== 'baseline'))
const scenario = computed(
  () => scenarioOptions.value.find((s) => s.kind === wizard.simKind) ?? scenarioOptions.value[0] ?? null,
)
const robot = computed(() => {
  const id = scenario.value?.robotId
  return id ? (wizard.robotById.get(id) ?? null) : null
})

/** Вход движка: число роботов — из расчёта сервера, характеристики — из каталога. */
const build = computed(() => {
  const plan = layout.value
  const current = scenario.value
  if (!plan || !current) return null
  return buildSimInput({
    layout: plan,
    params: wizard.params,
    assumptions: wizard.assumptions,
    scenario: current,
    robot: robot.value,
  })
})

const result = computed(() => wizard.simResult)
const timeline = computed(() => buildTimeline(result.value?.segments ?? [], SIM_HOURS * 3600))

// ---------- Проигрывание ----------
const playing = ref(false)
const speed = ref(60)
const timeSec = ref(0)
const canvasRef = ref<InstanceType<typeof SimulationCanvas> | null>(null)

function run() {
  const current = build.value
  if (current) void wizard.runSim(current.input)
}

function restart() {
  timeSec.value = 0
  playing.value = true
}

watch(build, run)
watch(result, () => {
  timeSec.value = 0
  playing.value = false
})

onMounted(() => {
  if (hasScenarios.value && (!wizard.result || wizard.economicsStale) && !wizard.economicsLoading) {
    void wizard.runEconomics()
  }
  run()
})

async function savePng() {
  const blob = await canvasRef.value?.toBlob()
  if (!blob) return
  const seconds = Math.round(timeSec.value)
  saveBlob(blob, `simulation-${wizard.objectType ?? 'object'}-${seconds}s.png`)
}

/** Кнопка вердикта: ставит ручное число роботов и возвращает на шаг «Экономика». */
function recalcWith(count: number) {
  const kind = scenario.value?.kind
  if (kind !== 'purchase' && kind !== 'raas') return
  wizard.setOverride(kind, 'robotCount', count)
  playing.value = false
  wizard.goTo(4)
}
</script>

<template>
  <div class="step-sim">
    <EmptyState
      v-if="!hasScenarios"
      title="Не выбраны роботы для сценариев"
      description="Симуляция проигрывает работу парка из расчёта. Выберите роботов на шаге «Сравнение»."
      :icon="Histogram"
    >
      <el-button type="primary" @click="wizard.goTo(3)">Перейти к сравнению</el-button>
    </EmptyState>

    <template v-else-if="!layout">
      <el-alert type="info" :closable="false" show-icon>
        <template #title>Симуляция пока доступна для склада</template>
        <p class="step-sim__text">
          Для объекта «{{ objectName }}» план с зонами ещё не подготовлен, поэтому проиграть работу
          роботов нельзя. Расчёт экономики и выгрузка отчёта от этого не зависят — можно переходить дальше.
        </p>
      </el-alert>
      <div class="step-sim__actions">
        <el-button type="primary" @click="wizard.goTo(7)">Перейти к экспорту</el-button>
      </div>
    </template>

    <template v-else>
      <div class="step-sim__bar">
        <p class="step-sim__text">
          Модель проигрывает один пиковый час работы и проверяет, справляется ли парк из расчёта
          с потоком заявок.
        </p>
        <el-radio-group
          :model-value="wizard.simKind"
          size="small"
          aria-label="Сценарий для симуляции"
          @update:model-value="(v) => wizard.setSimKind(v as 'purchase' | 'raas')"
        >
          <el-radio-button v-for="s in scenarioOptions" :key="s.id" :value="s.kind">{{ s.title }}</el-radio-button>
        </el-radio-group>
      </div>

      <ul v-if="build?.notes.length" class="step-sim__notes">
        <li v-for="note in build.notes" :key="note">{{ note }}</li>
      </ul>

      <ErrorAlert v-if="wizard.simError" :error="wizard.simError" retry @retry="run" />

      <p v-if="wizard.simLoading" class="step-sim__busy" role="status">
        <el-icon class="is-loading" aria-hidden="true"><Loading /></el-icon> Идёт расчёт модели…
      </p>

      <el-skeleton v-if="!result && (wizard.simLoading || wizard.economicsLoading)" :rows="6" animated aria-busy="true" />

      <EmptyState
        v-else-if="!result && !wizard.simError"
        title="Модель ещё не рассчитана"
        description="Сначала нужен расчёт экономики: из него берётся число роботов для прогона."
        :icon="Histogram"
      >
        <el-button type="primary" @click="wizard.goTo(4)">Перейти к экономике</el-button>
      </EmptyState>

      <template v-else-if="result">
        <SimulationCanvas
          ref="canvasRef"
          v-model:time-sec="timeSec"
          :layout="layout"
          :timeline="timeline"
          :playing="playing"
          :speed="speed"
          @finished="playing = false"
        />

        <SimLegend />

        <SimControls
          v-model:speed="speed"
          v-model:time-sec="timeSec"
          :playing="playing"
          :duration-sec="timeline.durationSec"
          :busy="wizard.simLoading"
          @play="playing = true"
          @pause="playing = false"
          @restart="restart"
          @save="savePng"
        />

        <SimKpiPanel
          :kpi="result.kpi"
          :queue-by-minute="result.queueByMinute"
          :robots-utilization="result.robotsUtilization"
          :robot-count="build?.robotCount ?? 0"
          :can-recalc="scenario !== null"
          @recalc="recalcWith"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.step-sim {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.step-sim__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.step-sim__text,
.step-sim__notes,
.step-sim__busy {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.step-sim__notes {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-left: var(--space-4);
}

.step-sim__busy {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.step-sim__actions {
  display: flex;
  gap: var(--space-3);
}
</style>
