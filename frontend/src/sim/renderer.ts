// Отрисовка симуляции на Canvas 2D (без библиотек) и подготовка кадра по модельному времени.
// Движок (engine.ts) даёт ленту отрезков; здесь она превращается в положение роботов
// на произвольный момент времени и в картинку плана объекта.
import type { Layout, Zone } from '@/types/api'
import type { Segment, SegmentState } from '@/types/sim'

export type Pt = [number, number]

export interface SimPalette {
  background: string
  surface: string
  border: string
  text: string
  textSecondary: string
  /** Заливка зоны по её типу. */
  zones: Record<Zone['type'], string>
  /** Цвет робота по состоянию. */
  robots: Record<SegmentState, string>
  /** Маршрут гружёного робота — «разметочный» жёлтый. */
  route: string
}

/** Значения по умолчанию совпадают с токенами styles/tokens.css. */
export const SIM_PALETTE: SimPalette = {
  background: '#f4f6f7',
  surface: '#ffffff',
  border: '#d5dce1',
  text: '#1e2a33',
  textSecondary: '#5b6b77',
  zones: {
    receiving: '#cfe0ea',
    storage: '#e3e8eb',
    picking: '#d9e7d9',
    shipping: '#ecd9d2',
    charging: '#f7e7c0',
    other: '#e6eaec',
  },
  robots: {
    idle: '#9aa7b1',
    moving_empty: '#5b8fb0',
    moving_loaded: '#2f5d7c',
    handling: '#2e8b57',
    charging: '#c98a00',
  },
  route: '#f2b705',
}

export const ROBOT_STATE_LABELS: Record<SegmentState, string> = {
  idle: 'Простой',
  moving_empty: 'Едет порожним',
  moving_loaded: 'Едет гружёным',
  handling: 'Погрузка или разгрузка',
  charging: 'Зарядка',
}

export const ZONE_LABELS: Record<Zone['type'], string> = {
  receiving: 'Приёмка',
  storage: 'Хранение',
  picking: 'Отбор',
  shipping: 'Отгрузка',
  charging: 'Зарядка',
  other: 'Прочее',
}

// ---------- Кадр по модельному времени ----------

export interface Timeline {
  /** Отрезки каждого робота по возрастанию времени; индекс — номер робота. */
  byRobot: Segment[][]
  robotCount: number
  durationSec: number
}

export function buildTimeline(segments: readonly Segment[], durationSec?: number): Timeline {
  const byRobot: Segment[][] = []
  let maxT = 0
  for (const s of segments) {
    const list = (byRobot[s.robot] ??= [])
    list.push(s)
    if (s.t1 > maxT) maxT = s.t1
  }
  for (let i = 0; i < byRobot.length; i++) {
    const list = (byRobot[i] ??= [])
    list.sort((a, b) => a.t0 - b.t0)
  }
  return { byRobot, robotCount: byRobot.length, durationSec: durationSec ?? maxT }
}

export interface RobotFrame {
  robot: number
  x: number
  y: number
  state: SegmentState
  /** Маршрут гружёного робота: откуда и куда он везёт груз; иначе null. */
  route: [Pt, Pt] | null
}

/** Отрезок, внутри которого лежит время t (двоичный поиск); null — вне ленты. */
function segmentAt(list: readonly Segment[], t: number): Segment | null {
  let low = 0
  let high = list.length - 1
  let found: Segment | null = null
  while (low <= high) {
    const mid = (low + high) >> 1
    const s = list[mid]!
    if (t < s.t0) high = mid - 1
    else if (t > s.t1) low = mid + 1
    else {
      found = s
      break
    }
  }
  return found
}

/** Положение и состояние каждого робота на момент timeSec. */
export function frameAt(timeline: Timeline, timeSec: number): RobotFrame[] {
  const frames: RobotFrame[] = []
  for (let robot = 0; robot < timeline.byRobot.length; robot++) {
    const list = timeline.byRobot[robot]!
    if (!list.length) continue
    const first = list[0]!
    const last = list[list.length - 1]!
    // За пределами ленты робот стоит в начальной или конечной точке.
    if (timeSec <= first.t0) {
      frames.push({ robot, x: first.from[0], y: first.from[1], state: 'idle', route: null })
      continue
    }
    if (timeSec >= last.t1) {
      frames.push({ robot, x: last.to[0], y: last.to[1], state: 'idle', route: null })
      continue
    }
    const segment = segmentAt(list, timeSec)
    if (!segment) continue
    const span = segment.t1 - segment.t0
    const progress = span > 0 ? (timeSec - segment.t0) / span : 1
    frames.push({
      robot,
      x: segment.from[0] + (segment.to[0] - segment.from[0]) * progress,
      y: segment.from[1] + (segment.to[1] - segment.from[1]) * progress,
      state: segment.state,
      route: segment.state === 'moving_loaded' ? [segment.from, segment.to] : null,
    })
  }
  return frames
}

// ---------- Масштаб ----------

export interface ViewTransform {
  /** Пикселей на метр. */
  scale: number
  dx: number
  dy: number
}

/** Вписывает план в размер холста с полями, сохраняя пропорции. */
export function fitTransform(
  layout: Pick<Layout, 'widthM' | 'heightM'>,
  widthPx: number,
  heightPx: number,
  paddingPx = 16,
): ViewTransform {
  const w = Math.max(1, layout.widthM)
  const h = Math.max(1, layout.heightM)
  const usableW = Math.max(1, widthPx - paddingPx * 2)
  const usableH = Math.max(1, heightPx - paddingPx * 2)
  const scale = Math.max(0.01, Math.min(usableW / w, usableH / h))
  return { scale, dx: (widthPx - w * scale) / 2, dy: (heightPx - h * scale) / 2 }
}

/** Длина отрезка масштабной линейки: круглое число метров, не длиннее четверти холста. */
export function scaleBarMeters(layout: Pick<Layout, 'widthM'>): number {
  const quarter = Math.max(1, layout.widthM / 4)
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
  return steps.filter((s) => s <= quarter).pop() ?? 1
}

// ---------- Холст ----------

/** Подгоняет размер холста под контейнер с учётом плотности пикселей (чёткость на HiDPI). */
export function resizeCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number, dpr = 1): void {
  const ratio = Math.max(1, Math.min(3, dpr))
  const width = Math.max(1, Math.round(cssWidth * ratio))
  const height = Math.max(1, Math.round(cssHeight * ratio))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  canvas.style.width = `${Math.max(1, Math.round(cssWidth))}px`
  canvas.style.height = `${Math.max(1, Math.round(cssHeight))}px`
}

export interface SceneOptions {
  layout: Layout
  frames: readonly RobotFrame[]
  /** Модельное время, с: подписывается на картинке, чтобы PNG был самодостаточным. */
  timeSec: number
  widthPx: number
  heightPx: number
  dpr?: number
  palette?: SimPalette
  /** Подпись времени: «12:30». */
  timeLabel?: string
}

/** Рисует кадр целиком: зоны, зарядные места, маршруты, роботов и масштабную линейку. */
export function drawScene(ctx: CanvasRenderingContext2D, options: SceneOptions): void {
  const palette = options.palette ?? SIM_PALETTE
  const { layout, frames, widthPx, heightPx } = options
  const ratio = Math.max(1, Math.min(3, options.dpr ?? 1))
  const view = fitTransform(layout, widthPx, heightPx)
  const toX = (m: number) => view.dx + m * view.scale
  const toY = (m: number) => view.dy + m * view.scale

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, widthPx, heightPx)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, widthPx, heightPx)

  // Контур объекта.
  ctx.fillStyle = palette.surface
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1
  ctx.fillRect(toX(0), toY(0), layout.widthM * view.scale, layout.heightM * view.scale)
  ctx.strokeRect(toX(0), toY(0), layout.widthM * view.scale, layout.heightM * view.scale)

  for (const zone of layout.zones) drawZone(ctx, zone, view, palette)
  drawRoutes(ctx, frames, view, palette)
  drawRobots(ctx, frames, view, palette)
  drawScaleBar(ctx, layout, view, palette, heightPx)

  if (options.timeLabel) {
    ctx.font = '600 12px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillStyle = palette.text
    ctx.fillText(`Модельное время ${options.timeLabel}`, widthPx - 8, 8)
  }
}

function drawZone(ctx: CanvasRenderingContext2D, zone: Zone, view: ViewTransform, palette: SimPalette): void {
  const [x, y, w, h] = zone.rect
  const px = view.dx + x * view.scale
  const py = view.dy + y * view.scale
  const pw = w * view.scale
  const ph = h * view.scale

  ctx.fillStyle = palette.zones[zone.type] ?? palette.zones.other
  ctx.fillRect(px, py, pw, ph)
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1
  ctx.strokeRect(px, py, pw, ph)

  // Зарядные места — отдельные ячейки внутри зоны, как разметка парковки.
  if (zone.type === 'charging') {
    const slots = Math.max(1, zone.slots ?? 1)
    ctx.strokeStyle = palette.textSecondary
    ctx.lineWidth = 1
    for (let i = 0; i < slots; i++) {
      const sw = pw / slots
      ctx.strokeRect(px + i * sw + 2, py + ph * 0.35, Math.max(2, sw - 4), Math.max(2, ph * 0.45))
    }
  }

  if (ph >= 14 && pw >= 40) {
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = palette.text
    ctx.fillText(zone.label, px + 4, py + 4, pw - 8)
  }
}

function drawRoutes(
  ctx: CanvasRenderingContext2D,
  frames: readonly RobotFrame[],
  view: ViewTransform,
  palette: SimPalette,
): void {
  ctx.strokeStyle = palette.route
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  for (const frame of frames) {
    if (!frame.route) continue
    const [from, to] = frame.route
    ctx.beginPath()
    ctx.moveTo(view.dx + from[0] * view.scale, view.dy + from[1] * view.scale)
    ctx.lineTo(view.dx + to[0] * view.scale, view.dy + to[1] * view.scale)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function drawRobots(
  ctx: CanvasRenderingContext2D,
  frames: readonly RobotFrame[],
  view: ViewTransform,
  palette: SimPalette,
): void {
  const radius = Math.max(4, Math.min(9, view.scale * 0.8))
  for (const frame of frames) {
    ctx.beginPath()
    ctx.arc(view.dx + frame.x * view.scale, view.dy + frame.y * view.scale, radius, 0, Math.PI * 2)
    ctx.fillStyle = palette.robots[frame.state]
    ctx.fill()
    ctx.strokeStyle = palette.surface
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  view: ViewTransform,
  palette: SimPalette,
  heightPx: number,
): void {
  const meters = scaleBarMeters(layout)
  const x0 = view.dx
  const y0 = Math.min(heightPx - 8, view.dy + layout.heightM * view.scale + 12)
  ctx.strokeStyle = palette.textSecondary
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x0 + meters * view.scale, y0)
  ctx.moveTo(x0, y0 - 3)
  ctx.lineTo(x0, y0 + 3)
  ctx.moveTo(x0 + meters * view.scale, y0 - 3)
  ctx.lineTo(x0 + meters * view.scale, y0 + 3)
  ctx.stroke()
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = palette.textSecondary
  ctx.fillText(`${meters} м`, x0 + meters * view.scale + 6, y0 + 4)
}
