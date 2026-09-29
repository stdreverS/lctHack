import { describe, expect, it } from 'vitest'
import type { Layout } from '@/types/api'
import type { Segment } from '@/types/sim'
import { buildTimeline, drawScene, fitTransform, frameAt, scaleBarMeters } from './renderer'

const segments: Segment[] = [
  { robot: 0, t0: 0, t1: 10, from: [0, 0], to: [10, 0], state: 'moving_empty' },
  { robot: 0, t0: 10, t1: 40, from: [10, 0], to: [10, 0], state: 'handling' },
  { robot: 0, t0: 40, t1: 60, from: [10, 0], to: [30, 20], state: 'moving_loaded' },
  { robot: 1, t0: 0, t1: 30, from: [5, 5], to: [5, 5], state: 'idle' },
  { robot: 1, t0: 30, t1: 60, from: [5, 5], to: [45, 5], state: 'moving_empty' },
]

describe('buildTimeline', () => {
  it('раскладывает отрезки по роботам и считает длительность', () => {
    const timeline = buildTimeline(segments)
    expect(timeline.robotCount).toBe(2)
    expect(timeline.byRobot[0]).toHaveLength(3)
    expect(timeline.durationSec).toBe(60)
  })

  it('длительность можно задать явно; робот без отрезков не ломает ленту', () => {
    const timeline = buildTimeline([segments[3]!], 3600)
    expect(timeline.durationSec).toBe(3600)
    expect(timeline.byRobot[0]).toEqual([])
    expect(timeline.byRobot[1]).toHaveLength(1)
    expect(frameAt(timeline, 10)).toHaveLength(1)
  })
})

describe('frameAt', () => {
  const timeline = buildTimeline(segments, 60)

  it('интерполирует положение внутри отрезка', () => {
    const [first] = frameAt(timeline, 5)
    expect(first).toMatchObject({ robot: 0, x: 5, y: 0, state: 'moving_empty' })
  })

  it('на месте погрузки робот стоит', () => {
    const frame = frameAt(timeline, 20).find((f) => f.robot === 0)!
    expect(frame).toMatchObject({ x: 10, y: 0, state: 'handling' })
    expect(frame.route).toBeNull()
  })

  it('у гружёного робота есть маршрут для жёлтой линии', () => {
    const frame = frameAt(timeline, 50).find((f) => f.robot === 0)!
    expect(frame.state).toBe('moving_loaded')
    expect(frame.route).toEqual([[10, 0], [30, 20]])
    expect(frame.x).toBe(20)
    expect(frame.y).toBe(10)
  })

  it('до начала и после конца ленты роботы стоят в крайних точках', () => {
    expect(frameAt(timeline, 0).find((f) => f.robot === 0)).toMatchObject({ x: 0, y: 0, state: 'idle' })
    const last = frameAt(timeline, 999).find((f) => f.robot === 0)!
    expect(last).toMatchObject({ x: 30, y: 20, state: 'idle' })
  })

  it('кадр возвращает всех роботов ленты', () => {
    expect(frameAt(timeline, 45).map((f) => f.robot)).toEqual([0, 1])
  })
})

describe('fitTransform', () => {
  it('вписывает план целиком и центрирует его', () => {
    const view = fitTransform({ widthM: 100, heightM: 50 }, 532, 300, 16)
    expect(view.scale).toBeCloseTo(5, 5)
    expect(view.dx).toBeCloseTo(16, 5)
    expect(view.dy).toBeCloseTo(25, 5)
  })

  it('узкий холст — масштаб по меньшей стороне, без отрицательных значений', () => {
    const view = fitTransform({ widthM: 120, heightM: 100 }, 200, 600, 16)
    expect(view.scale).toBeCloseTo((200 - 32) / 120, 5)
    expect(view.dy).toBeGreaterThan(0)
    expect(fitTransform({ widthM: 0, heightM: 0 }, 10, 10, 16).scale).toBeGreaterThan(0)
  })
})

describe('scaleBarMeters', () => {
  it('круглая длина линейки не больше четверти плана', () => {
    expect(scaleBarMeters({ widthM: 120 })).toBe(20)
    expect(scaleBarMeters({ widthM: 45 })).toBe(10)
    expect(scaleBarMeters({ widthM: 3 })).toBe(0 + 1)
  })
})

// ---------- Отрисовка ----------

/** Заглушка контекста: запоминает вызовы, чтобы проверить, что кадр рисуется целиком. */
function stubContext() {
  const calls: string[] = []
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop: string) {
      if (prop === 'calls') return calls
      if (prop in target) return target[prop]
      return (...args: unknown[]) => {
        calls.push(`${prop}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : String(a))).join(',')})`)
      }
    },
    set(target, prop: string, value) {
      calls.push(`${prop}=${String(value)}`)
      target[prop] = value
      return true
    },
  }
  return new Proxy({} as Record<string, unknown>, handler) as unknown as CanvasRenderingContext2D & { calls: string[] }
}

describe('drawScene', () => {
  const layout: Layout = {
    widthM: 120,
    heightM: 100,
    zones: [
      { id: 'z-storage', type: 'storage', label: 'Хранение', rect: [30, 0, 90, 70] },
      { id: 'z-charging', type: 'charging', label: 'Зарядка', rect: [95, 80, 25, 20], slots: 3 },
    ],
  }

  it('рисует зоны, зарядные места, маршрут, роботов и время', () => {
    const ctx = stubContext()
    const frames = frameAt(buildTimeline(segments, 60), 50)
    drawScene(ctx, { layout, frames, timeSec: 50, widthPx: 600, heightPx: 400, dpr: 2, timeLabel: '00:50' })
    const calls = ctx.calls.join('\n')
    expect(calls).toContain('setTransform(2,0,0,2,0,0)')
    expect(calls).toContain('clearRect(0,0,600,400)')
    // Подписи зон и подпись времени.
    expect(calls).toContain('Хранение')
    expect(calls).toContain('Модельное время 00:50')
    // Жёлтая линия маршрута гружёного робота и кружки роботов.
    expect(calls).toContain('setLineDash(6,4)')
    expect(ctx.calls.filter((c) => c.startsWith('arc('))).toHaveLength(frames.length)
    // Масштабная линейка.
    expect(calls).toContain('20 м')
  })

  it('пустой кадр не ломает отрисовку', () => {
    const ctx = stubContext()
    drawScene(ctx, { layout, frames: [], timeSec: 0, widthPx: 320, heightPx: 200 })
    expect(ctx.calls.filter((c) => c.startsWith('arc('))).toHaveLength(0)
  })
})
