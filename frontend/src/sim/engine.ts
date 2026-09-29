// Движок 2D-симуляции: дискретно-событийная модель работы парка роботов.
// runSimulation — чистая функция: одинаковый вход (включая seed) даёт одинаковый выход,
// ничего не читает снаружи и ничего не меняет. Допущения модели — docs/simulation.md.
import type { Layout, SimKpi, Zone } from '@/types/api'
import type { Segment, SegmentState, SimInput, SimResult } from '@/types/sim'
import { exponentialInterval, mulberry32, randomBetween, weightedIndex, type Random } from './random'

type Pt = [number, number]

/** Константы модели. Все допущения симуляции собраны здесь (docs/simulation.md). */
export const SIM_MODEL = {
  engineVersion: 'sim-1.2',
  /** Погрузка или разгрузка, с, если не задано во входных данных. */
  handlingSec: 30,
  /** Доля заряда, ниже которой робот едет на зарядку. */
  chargeThreshold: 0.2,
  /** Разгон модели: первые 10 минут не учитываются в KPI. */
  warmupSec: 600,
  /** Нижняя граница скорости, м/с: в каталоге скорость может быть не указана. */
  minSpeedMps: 0.1,
  /** Зарядных мест, если в зоне не задано slots. */
  chargerSlots: 1,
  /** Предел числа заявок за прогон: защита от абсурдного спроса. */
  maxTasks: 200_000,
  /** Смесь маршрутов: доля заявок по парам зон. Нет зоны — правило выпадает. */
  routeMix: [
    { from: 'receiving', to: 'storage', share: 0.35 },
    { from: 'storage', to: 'picking', share: 0.4 },
    { from: 'picking', to: 'shipping', share: 0.25 },
  ],
  /** Доля занятого времени, выше которой узкое место — нехватка роботов. */
  busyShare: 0.9,
  /** Доля времени на зарядке, выше которой узкое место — зарядка. */
  chargingShare: 0.2,
  /**
   * Порог подтверждения расчёта, % целевой производительности. Не 100: поток заявок
   * случайный, и за один час прогона поступает в среднем 100 % цели, но с разбросом
   * (30 зёрен на демо-складе: 90,7–112,5 %). Порог ниже нижней границы разброса.
   */
  confirmPercent: 90,
} as const

// ---------- Геометрия ----------

function centerOf(zone: Zone): Pt {
  const [x, y, w, h] = zone.rect
  return [x + w / 2, y + h / 2]
}

function pointIn(zone: Zone, rng: Random): Pt {
  const [x, y, w, h] = zone.rect
  return [randomBetween(rng, x, x + w), randomBetween(rng, y, y + h)]
}

function distance(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Точки зарядных мест: равномерно по ширине зоны, чтобы роботы не стояли друг в друге. */
function slotPoints(zone: Zone, slots: number): Pt[] {
  const [x, y, w, h] = zone.rect
  const n = Math.max(1, slots)
  return Array.from({ length: n }, (_, i): Pt => [x + (w * (i + 0.5)) / n, y + h / 2])
}

// ---------- Маршруты и поток заявок ----------

interface Route {
  from: Zone
  to: Zone
  share: number
}

/**
 * Пары зон, между которыми ездят роботы: приёмка → хранение → отбор → отгрузка.
 * Схема даёт только координаты; длина маршрута задаётся параметром avgRouteM.
 */
function buildRoutes(layout: Layout): Route[] {
  const byType = (type: Zone['type']) => layout.zones.find((z) => z.type === type) ?? null
  const routes: Route[] = []
  for (const rule of SIM_MODEL.routeMix) {
    const from = byType(rule.from)
    const to = byType(rule.to)
    if (from && to) routes.push({ from, to, share: rule.share })
  }
  if (routes.length) return routes

  // Непривычный план: берём любые рабочие зоны, а если их нет — весь объект целиком.
  const work = layout.zones.filter((z) => z.type !== 'charging')
  const whole: Zone = { id: 'z-all', type: 'other', label: 'Объект', rect: [0, 0, layout.widthM, layout.heightM] }
  const from = work[0] ?? whole
  const to = work[1] ?? from
  return [{ from, to, share: 1 }]
}

interface Task {
  /** Момент поступления заявки, с. */
  t: number
  from: Pt
  to: Pt
  /** Длина гружёного маршрута, м. */
  distM: number
}

/**
 * Заявки поступают пуассоновским потоком со средней интенсивностью peakOpsPerHour.
 * Расстояния нормируются так, чтобы средний гружёный маршрут равнялся avgRouteM.
 */
function generateTasks(input: SimInput, rng: Random, routes: Route[], simSec: number): { tasks: Task[]; scale: number } {
  const shares = routes.map((r) => r.share)
  const tasks: Task[] = []
  let t = exponentialInterval(rng, Math.max(0, input.demand.peakOpsPerHour) / 3600)
  while (t <= simSec && tasks.length < SIM_MODEL.maxTasks) {
    const route = routes[weightedIndex(rng, shares)] ?? routes[0]!
    const from = pointIn(route.from, rng)
    const to = pointIn(route.to, rng)
    tasks.push({ t, from, to, distM: distance(from, to) })
    t += exponentialInterval(rng, Math.max(0, input.demand.peakOpsPerHour) / 3600)
  }

  const avgRouteM = Math.max(0, input.demand.avgRouteM)
  const rawMean = tasks.length ? tasks.reduce((sum, task) => sum + task.distM, 0) / tasks.length : 0
  // Зоны совпали (длины на схеме нет) — берём длину прямо из параметров.
  const scale = rawMean > 0 ? avgRouteM / rawMean : 1
  for (const task of tasks) task.distM = rawMean > 0 ? task.distM * scale : avgRouteM
  return { tasks, scale }
}

// ---------- Очередь событий ----------

type EventKind = 'free' | 'chargeArrive' | 'chargeDone'
interface SimEvent {
  t: number
  seq: number
  kind: EventKind
  robot: number
}

/** Двоичная куча по времени; при равном времени порядок задаёт seq — прогон детерминирован. */
class EventQueue {
  private items: SimEvent[] = []
  private seq = 0

  push(t: number, kind: EventKind, robot: number): void {
    const item: SimEvent = { t, seq: this.seq++, kind, robot }
    this.items.push(item)
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.before(this.items[i]!, this.items[parent]!)) {
        ;[this.items[i], this.items[parent]] = [this.items[parent]!, this.items[i]!]
        i = parent
      } else break
    }
  }

  peekTime(): number {
    return this.items[0]?.t ?? Infinity
  }

  pop(): SimEvent | null {
    const top = this.items[0]
    if (!top) return null
    const last = this.items.pop()!
    if (this.items.length) {
      this.items[0] = last
      let i = 0
      for (;;) {
        const left = i * 2 + 1
        const right = left + 1
        let best = i
        if (left < this.items.length && this.before(this.items[left]!, this.items[best]!)) best = left
        if (right < this.items.length && this.before(this.items[right]!, this.items[best]!)) best = right
        if (best === i) break
        ;[this.items[i], this.items[best]] = [this.items[best]!, this.items[i]!]
        i = best
      }
    }
    return top
  }

  private before(a: SimEvent, b: SimEvent): boolean {
    return a.t === b.t ? a.seq < b.seq : a.t < b.t
  }
}

// ---------- Робот ----------

interface RobotRt {
  id: number
  pos: Pt
  /** Занят заявкой, дорогой к зарядке или зарядкой. */
  busy: boolean
  /** С какого момента простаивает без работы. */
  idleSince: number
  /** С какого момента ждёт освобождения зарядного места; -1 — не ждёт. */
  waitSince: number
  /** Остаток заряда в секундах работы; Infinity — расход заряда отключён. */
  batterySec: number
  travel: number
  handling: number
  charge: number
  idle: number
}

type Bucket = 'travel' | 'handling' | 'charge' | 'idle'

function share(value: number, total: number): number {
  return total > 0 ? value / total : 0
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
}

// ---------- Прогон ----------

export function runSimulation(input: SimInput): SimResult {
  const simSec = Math.max(0, input.simHours) * 3600
  const rng = mulberry32(input.seed)
  const routes = buildRoutes(input.layout)
  const { tasks, scale } = generateTasks(input, rng, routes, simSec)

  const count = Math.max(0, Math.trunc(input.robots.count))
  const speed = Math.max(SIM_MODEL.minSpeedMps, input.robots.speedMps)
  const handlingSec =
    typeof input.robots.handlingSec === 'number' && input.robots.handlingSec >= 0
      ? input.robots.handlingSec
      : SIM_MODEL.handlingSec
  const opsPerHour = input.robots.opsPerHour
  // Время цикла заявки из каталога: погрузка, два проезда и разгрузка вместе.
  const cycleSec = typeof opsPerHour === 'number' && opsPerHour > 0 ? 3600 / opsPerHour : null
  const fullBatterySec = Math.max(0, input.robots.autonomyH) * 3600
  const chargeSec = Math.max(0, input.robots.chargeTimeH) * 3600
  const chargeZone = input.layout.zones.find((z) => z.type === 'charging') ?? null
  // Нет зоны зарядки или не задана автономность — заряд в модели не расходуется.
  const chargingOn = fullBatterySec > 0 && chargeZone !== null
  const chargePoints = chargeZone ? slotPoints(chargeZone, chargeZone.slots ?? SIM_MODEL.chargerSlots) : []
  let freeSlots = chargeZone ? Math.max(1, chargeZone.slots ?? SIM_MODEL.chargerSlots) : 0

  const start: Pt = chargeZone ? centerOf(chargeZone) : centerOf(routes[0]!.from)
  const robots: RobotRt[] = Array.from({ length: count }, (_, id) => ({
    id,
    pos: chargePoints[id % Math.max(1, chargePoints.length)] ?? start,
    busy: false,
    idleSince: 0,
    waitSince: -1,
    batterySec: chargingOn ? fullBatterySec : Infinity,
    travel: 0,
    handling: 0,
    charge: 0,
    idle: 0,
  }))

  const segments: Segment[] = []
  const completions: number[] = []
  const queueLog: { t: number; len: number }[] = [{ t: 0, len: 0 }]
  const windowStart = simSec > SIM_MODEL.warmupSec ? SIM_MODEL.warmupSec : 0

  function emit(r: RobotRt, state: SegmentState, t0: number, t1: number, from: Pt, to: Pt, bucket: Bucket): void {
    if (t1 > t0) segments.push({ robot: r.id, t0, t1, from, to, state })
    // В KPI попадает только то, что попало в окно измерения (после разгона).
    const a = Math.max(t0, windowStart)
    const b = Math.min(t1, simSec)
    if (b > a) r[bucket] += b - a
  }

  function closeIdle(r: RobotRt, t: number): void {
    if (!r.busy && r.idleSince < t) emit(r, 'idle', r.idleSince, t, r.pos, r.pos, 'idle')
    r.idleSince = t
  }

  const pending: Task[] = []
  let head = 0
  const queueLen = () => pending.length - head
  const events = new EventQueue()

  function assign(r: RobotRt, task: Task, t: number): void {
    closeIdle(r, t)
    const emptySec = (distance(r.pos, task.from) * scale) / speed
    const loadedSec = task.distM / speed
    // Производительность из каталога: растягиваем или сжимаем цикл до 3600 / opsPerHour с.
    const k = cycleSec === null ? 1 : cycleSec / (emptySec + loadedSec + 2 * handlingSec)
    const emptyEnd = t + emptySec * k
    emit(r, 'moving_empty', t, emptyEnd, r.pos, task.from, 'travel')
    const loadEnd = emptyEnd + handlingSec * k
    emit(r, 'handling', emptyEnd, loadEnd, task.from, task.from, 'handling')
    const loadedEnd = loadEnd + loadedSec * k
    emit(r, 'moving_loaded', loadEnd, loadedEnd, task.from, task.to, 'travel')
    const end = loadedEnd + handlingSec * k
    emit(r, 'handling', loadedEnd, end, task.to, task.to, 'handling')

    r.batterySec = Math.max(0, r.batterySec - (end - t))
    r.pos = task.to
    r.busy = true
    completions.push(end)
    events.push(end, 'free', r.id)
  }

  function sendToCharge(r: RobotRt, t: number): void {
    closeIdle(r, t)
    const point = chargePoints[r.id % Math.max(1, chargePoints.length)] ?? r.pos
    const arrive = t + (distance(r.pos, point) * scale) / speed
    emit(r, 'moving_empty', t, arrive, r.pos, point, 'charge')
    r.batterySec = Math.max(0, r.batterySec - (arrive - t))
    r.pos = point
    r.busy = true
    events.push(arrive, 'chargeArrive', r.id)
  }

  function startCharging(r: RobotRt, t: number): void {
    freeSlots--
    if (chargeSec > 0) emit(r, 'charging', t, t + chargeSec, r.pos, r.pos, 'charge')
    events.push(t + chargeSec, 'chargeDone', r.id)
  }

  const waiting: RobotRt[] = []

  function handle(event: SimEvent): void {
    const r = robots[event.robot]!
    if (event.kind === 'free') {
      r.busy = false
      r.idleSince = event.t
      return
    }
    if (event.kind === 'chargeArrive') {
      if (freeSlots > 0) startCharging(r, event.t)
      else {
        // Все зарядные места заняты — робот ждёт очереди у зоны зарядки.
        r.waitSince = event.t
        waiting.push(r)
      }
      return
    }
    // chargeDone
    freeSlots++
    r.batterySec = fullBatterySec
    r.busy = false
    r.idleSince = event.t
    const next = waiting.shift()
    if (next) {
      emit(next, 'idle', next.waitSince, event.t, next.pos, next.pos, 'idle')
      next.waitSince = -1
      startCharging(next, event.t)
    }
  }

  function dispatch(t: number): void {
    if (t >= simSec) return
    if (chargingOn) {
      for (const r of robots) {
        if (!r.busy && r.batterySec < fullBatterySec * SIM_MODEL.chargeThreshold) sendToCharge(r, t)
      }
    }
    while (head < pending.length) {
      const task = pending[head]!
      // Заявки берутся в порядке поступления; из свободных роботов едет ближайший.
      let chosen: RobotRt | null = null
      let bestDist = Infinity
      for (const r of robots) {
        if (r.busy) continue
        const d = distance(r.pos, task.from)
        if (d < bestDist) {
          bestDist = d
          chosen = r
        }
      }
      if (!chosen) break
      head++
      queueLog.push({ t, len: queueLen() })
      assign(chosen, task, t)
    }
  }

  let taskIdx = 0
  for (;;) {
    const nextArrival = taskIdx < tasks.length ? tasks[taskIdx]!.t : Infinity
    const nextEvent = events.peekTime()
    const t = Math.min(nextArrival, nextEvent)
    if (!Number.isFinite(t)) break
    if (nextArrival <= nextEvent) {
      pending.push(tasks[taskIdx]!)
      taskIdx++
      queueLog.push({ t, len: queueLen() })
    } else {
      handle(events.pop()!)
    }
    dispatch(t)
  }

  // Хвост прогона: простой до конца часа и ожидание зарядного места.
  for (const r of robots) {
    if (r.waitSince >= 0) emit(r, 'idle', r.waitSince, simSec, r.pos, r.pos, 'idle')
    else closeIdle(r, simSec)
  }

  return {
    segments,
    kpi: buildKpi(input, robots, completions, queueLog, simSec, windowStart),
    queueByMinute: queueByMinute(queueLog, simSec),
    robotsUtilization: robots.map((r) => round(share(r.travel + r.handling, simSec - windowStart), 4)),
  }
}

// ---------- KPI ----------

function queueByMinute(queueLog: { t: number; len: number }[], simSec: number): number[] {
  const minutes = Math.ceil(simSec / 60)
  const result: number[] = []
  let i = 0
  let len = 0
  for (let m = 0; m < minutes; m++) {
    const mark = Math.min((m + 1) * 60, simSec)
    while (i < queueLog.length && queueLog[i]!.t <= mark) {
      len = queueLog[i]!.len
      i++
    }
    result.push(len)
  }
  return result
}

function maxQueueIn(queueLog: { t: number; len: number }[], windowStart: number): number {
  let atStart = 0
  let max = 0
  for (const point of queueLog) {
    if (point.t < windowStart) atStart = point.len
    else max = Math.max(max, point.len)
  }
  return Math.max(max, atStart)
}

function buildKpi(
  input: SimInput,
  robots: RobotRt[],
  completions: number[],
  queueLog: { t: number; len: number }[],
  simSec: number,
  windowStart: number,
): SimKpi {
  const windowSec = simSec - windowStart
  const done = completions.filter((t) => t > windowStart && t <= simSec).length
  const throughputPerHour = windowSec > 0 ? done / (windowSec / 3600) : 0
  const targetPerHour = Math.max(0, input.demand.peakOpsPerHour)
  // Целевого потока нет — считать нечего, парк условно справляется.
  const achievedPercent = targetPerHour > 0 ? (throughputPerHour / targetPerHour) * 100 : 100

  const travelShare = mean(robots.map((r) => share(r.travel, windowSec)))
  const handlingShare = mean(robots.map((r) => share(r.handling, windowSec)))
  const chargingShare = mean(robots.map((r) => share(r.charge, windowSec)))
  const idleShare = mean(robots.map((r) => share(r.idle, windowSec)))
  const avgUtilization = travelShare + handlingShare
  const maxQueue = maxQueueIn(queueLog, windowStart)

  return {
    engineVersion: input.engineVersion ?? SIM_MODEL.engineVersion,
    seed: input.seed,
    throughputPerHour: round(throughputPerHour, 1),
    targetPerHour: round(targetPerHour, 1),
    achievedPercent: round(achievedPercent, 1),
    avgUtilization: round(avgUtilization, 3),
    idleShare: round(idleShare, 3),
    chargingShare: round(chargingShare, 3),
    maxQueue,
    bottleneck: bottleneck({
      count: robots.length,
      achievedPercent,
      avgUtilization,
      chargingShare,
      travelShare,
      handlingShare,
      maxQueue,
      avgRouteM: Math.max(0, input.demand.avgRouteM),
    }),
    confirmsCalculation: achievedPercent >= SIM_MODEL.confirmPercent,
  }
}

interface BottleneckInput {
  count: number
  achievedPercent: number
  avgUtilization: number
  chargingShare: number
  travelShare: number
  handlingShare: number
  maxQueue: number
  avgRouteM: number
}

/** «31 заявки», «2 заявок»: форма слова после «до» в тексте про очередь. */
function tasksWord(count: number): string {
  const n = Math.abs(count)
  return n % 10 === 1 && n % 100 !== 11 ? 'заявки' : 'заявок'
}

/** Узкое место одной фразой на русском: что именно мешает закрыть поток. */
function bottleneck(p: BottleneckInput): string {
  const pct = (v: number) => Math.round(v * 100)
  if (p.count === 0) return 'Роботы не заданы: заявки выполнять некому'
  if (p.achievedPercent >= 100) {
    return `Узких мест нет: парк закрывает поток, средняя загрузка ${pct(p.avgUtilization)} %`
  }
  if (p.chargingShare > SIM_MODEL.chargingShare) {
    return `Зарядка: ${pct(p.chargingShare)} % времени уходит на зарядку и дорогу к зарядным местам — не хватает ёмкости батареи или зарядных мест`
  }
  if (p.avgUtilization >= SIM_MODEL.busyShare) {
    return `Не хватает роботов: парк занят ${pct(p.avgUtilization)} % времени, очередь доходит до ${p.maxQueue} ${tasksWord(p.maxQueue)}`
  }
  if (p.handlingShare > p.travelShare) {
    return `Погрузка и разгрузка: ${pct(p.handlingShare)} % времени занимают операции с грузом`
  }
  return `Длина маршрута: ${Math.round(p.avgRouteM)} м в одну сторону, на переезды уходит ${pct(p.travelShare)} % времени`
}
