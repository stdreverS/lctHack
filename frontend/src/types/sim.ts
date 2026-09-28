// Типы 2D-симуляции. Симуляция считается на фронтенде (CLAUDE.md, раздел 4):
// это единственное исключение из правила «расчёты — на сервере».
// KPI симуляции (SimKpi) уходит на сервер вместе с запросом расчёта, поэтому его тип
// живёт в types/api.ts, а не здесь.
import type { Layout, SimKpi } from './api'

/** Поток заявок на объекте. */
export interface SimDemand {
  /** Целевая интенсивность в пиковый час, операций/ч. */
  peakOpsPerHour: number
  /** Средняя длина маршрута в одну сторону, м. Задаёт масштаб расстояний. */
  avgRouteM: number
}

/** Парк роботов: все роботы одинаковые (симуляция одного сценария). */
export interface SimRobots {
  count: number
  speedMps: number
  /** Погрузка или разгрузка, с. Не задано — SIM_MODEL.handlingSec. */
  handlingSec?: number
  /** Время работы на одном заряде, ч. 0 — заряд не расходуется. */
  autonomyH: number
  /** Полная зарядка, ч. */
  chargeTimeH: number
}

export interface SimInput {
  /** Версия движка. Не задано — SIM_MODEL.engineVersion. */
  engineVersion?: string
  /** Зерно генератора: один и тот же seed даёт один и тот же результат. */
  seed: number
  /** Длительность прогона, ч. */
  simHours: number
  /** План объекта: зоны и их координаты (ObjectType.layout). */
  layout: Layout
  demand: SimDemand
  robots: SimRobots
}

export type SegmentState = 'moving_empty' | 'moving_loaded' | 'handling' | 'charging' | 'idle'

/** Отрезок жизни робота: что он делал с t0 по t1 и где. Время — секунды от начала прогона. */
export interface Segment {
  /** Индекс робота, 0…count-1. */
  robot: number
  t0: number
  t1: number
  from: [number, number]
  to: [number, number]
  state: SegmentState
}

export interface SimResult {
  segments: Segment[]
  kpi: SimKpi
  /** Длина очереди заявок на конец каждой минуты прогона. */
  queueByMinute: number[]
  /** Загрузка каждого робота, доля 0–1. Индекс — номер робота. */
  robotsUtilization: number[]
}
