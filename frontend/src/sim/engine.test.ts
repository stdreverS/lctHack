import { describe, expect, it } from 'vitest'
import type { Layout } from '@/types/api'
import type { SimInput } from '@/types/sim'
import { runSimulation, SIM_MODEL } from './engine'

const layout: Layout = {
  widthM: 120,
  heightM: 100,
  zones: [
    { id: 'z-receiving', type: 'receiving', label: 'Приёмка', rect: [0, 0, 25, 40], slots: 8 },
    { id: 'z-storage', type: 'storage', label: 'Зона хранения', rect: [30, 0, 90, 70], slots: 2400 },
    { id: 'z-picking', type: 'picking', label: 'Отбор заказов', rect: [30, 75, 60, 25], slots: 40 },
    { id: 'z-shipping', type: 'shipping', label: 'Отгрузка', rect: [0, 60, 25, 40], slots: 10 },
    { id: 'z-charging', type: 'charging', label: 'Зарядка', rect: [95, 80, 25, 20], slots: 4 },
  ],
}

function input(over: Partial<SimInput> = {}, robots: Partial<SimInput['robots']> = {}): SimInput {
  return {
    seed: 42,
    simHours: 1,
    layout,
    demand: { peakOpsPerHour: 120, avgRouteM: 120 },
    robots: { count: 6, speedMps: 1.5, handlingSec: 30, autonomyH: 8, chargeTimeH: 2, ...robots },
    ...over,
  }
}

describe('runSimulation: воспроизводимость', () => {
  it('одинаковый seed — одинаковый результат', () => {
    expect(runSimulation(input())).toEqual(runSimulation(input()))
  })

  it('другой seed — другой прогон, но тот же порядок величин', () => {
    const a = runSimulation(input({ seed: 1 }))
    const b = runSimulation(input({ seed: 2 }))
    expect(a.kpi.seed).toBe(1)
    expect(b.kpi.seed).toBe(2)
    expect(a.segments).not.toEqual(b.segments)
    expect(Math.abs(a.kpi.throughputPerHour - b.kpi.throughputPerHour)).toBeLessThan(
      a.kpi.targetPerHour * 0.3,
    )
  })

  it('версия движка — sim-1.0', () => {
    expect(runSimulation(input()).kpi.engineVersion).toBe('sim-1.0')
    expect(SIM_MODEL.engineVersion).toBe('sim-1.0')
  })
})

describe('runSimulation: парк и поток', () => {
  it('больше роботов — производительность не меньше', () => {
    const small = runSimulation(input({}, { count: 2 }))
    const big = runSimulation(input({}, { count: 12 }))
    expect(big.kpi.throughputPerHour).toBeGreaterThanOrEqual(small.kpi.throughputPerHour)
    expect(big.kpi.maxQueue).toBeLessThanOrEqual(small.kpi.maxQueue)
  })

  it('ноль роботов — нет выполненных заявок и расчёт не подтверждён', () => {
    const result = runSimulation(input({}, { count: 0 }))
    expect(result.kpi.throughputPerHour).toBe(0)
    expect(result.kpi.achievedPercent).toBe(0)
    expect(result.kpi.confirmsCalculation).toBe(false)
    expect(result.kpi.maxQueue).toBeGreaterThan(0)
    expect(result.segments).toHaveLength(0)
    expect(result.robotsUtilization).toHaveLength(0)
    expect(result.kpi.bottleneck).toContain('Роботы не заданы')
  })

  it('парк с запасом закрывает поток и подтверждает расчёт', () => {
    const result = runSimulation(input({ demand: { peakOpsPerHour: 60, avgRouteM: 60 } }, { count: 20 }))
    expect(result.kpi.achievedPercent).toBeGreaterThanOrEqual(100)
    expect(result.kpi.confirmsCalculation).toBe(true)
    expect(result.kpi.idleShare).toBeGreaterThan(0)
  })

  it('очень большой спрос — очередь растёт, названо узкое место', () => {
    const result = runSimulation(input({ demand: { peakOpsPerHour: 3000, avgRouteM: 150 } }, { count: 3 }))
    const minutes = result.queueByMinute
    expect(minutes.length).toBe(60)
    expect(minutes[59]!).toBeGreaterThan(minutes[9]!)
    expect(result.kpi.maxQueue).toBeGreaterThan(100)
    expect(result.kpi.confirmsCalculation).toBe(false)
    expect(result.kpi.bottleneck.length).toBeGreaterThan(10)
    expect(result.kpi.avgUtilization).toBeGreaterThan(0.9)
  })
})

describe('runSimulation: время роботов', () => {
  it('загрузка, простой и зарядка в сумме дают всё время прогона', () => {
    const kpi = runSimulation(input()).kpi
    expect(kpi.avgUtilization + kpi.idleShare + kpi.chargingShare).toBeCloseTo(1, 2)
    expect(kpi.avgUtilization).toBeGreaterThan(0)
  })

  it('загрузка считается по каждому роботу', () => {
    const result = runSimulation(input({}, { count: 6 }))
    expect(result.robotsUtilization).toHaveLength(6)
    for (const u of result.robotsUtilization) {
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(1)
    }
    const avg = result.robotsUtilization.reduce((s, u) => s + u, 0) / 6
    expect(avg).toBeCloseTo(result.kpi.avgUtilization, 2)
  })

  it('короткая автономность — роботы заряжаются, длинная — нет', () => {
    const short = runSimulation(input({}, { autonomyH: 0.3, chargeTimeH: 0.5 }))
    const long = runSimulation(input({}, { autonomyH: 12, chargeTimeH: 2 }))
    expect(short.kpi.chargingShare).toBeGreaterThan(0)
    expect(long.kpi.chargingShare).toBe(0)
    expect(short.segments.some((s) => s.state === 'charging')).toBe(true)
  })

  it('зарядных мест меньше, чем роботов — появляется ожидание очереди', () => {
    const narrow: Layout = {
      ...layout,
      zones: layout.zones.map((z) => (z.type === 'charging' ? { ...z, slots: 1 } : z)),
    }
    const result = runSimulation(input({ layout: narrow }, { count: 8, autonomyH: 0.25, chargeTimeH: 1 }))
    const charging = result.segments.filter((s) => s.state === 'charging')
    // Одно зарядное место: два робота не могут заряжаться одновременно.
    for (const a of charging) {
      const overlap = charging.filter((b) => b !== a && b.t0 < a.t1 && a.t0 < b.t1)
      expect(overlap).toHaveLength(0)
    }
    expect(result.kpi.idleShare).toBeGreaterThan(0)
  })
})

describe('runSimulation: маршруты', () => {
  it('средний гружёный маршрут равен заданному avgRouteM', () => {
    const avgRouteM = 200
    const speedMps = 2
    const result = runSimulation(input({ demand: { peakOpsPerHour: 90, avgRouteM } }, { count: 8, speedMps }))
    const loaded = result.segments.filter((s) => s.state === 'moving_loaded')
    expect(loaded.length).toBeGreaterThan(10)
    const meanM = loaded.reduce((sum, s) => sum + (s.t1 - s.t0) * speedMps, 0) / loaded.length
    expect(meanM).toBeGreaterThan(avgRouteM * 0.8)
    expect(meanM).toBeLessThan(avgRouteM * 1.2)
  })

  it('отрезки робота идут подряд и без разрывов', () => {
    const result = runSimulation(input({}, { count: 3 }))
    for (let id = 0; id < 3; id++) {
      const own = result.segments.filter((s) => s.robot === id)
      expect(own.length).toBeGreaterThan(0)
      expect(own[0]!.t0).toBe(0)
      for (let i = 1; i < own.length; i++) expect(own[i]!.t0).toBeCloseTo(own[i - 1]!.t1, 6)
    }
  })

  it('план без зон зарядки и без привычных зон не ломает прогон', () => {
    const plain: Layout = {
      widthM: 50,
      heightM: 50,
      zones: [{ id: 'z-hall', type: 'other', label: 'Зал', rect: [0, 0, 50, 50] }],
    }
    const result = runSimulation(input({ layout: plain }, { count: 4 }))
    expect(result.kpi.chargingShare).toBe(0)
    expect(result.kpi.throughputPerHour).toBeGreaterThan(0)
    expect(result.segments.every((s) => s.state !== 'charging')).toBe(true)
  })
})

describe('runSimulation: окно измерения и скорость', () => {
  it('первые 10 минут не учитываются в KPI', () => {
    expect(SIM_MODEL.warmupSec).toBe(600)
    const result = runSimulation(input({ simHours: 1 }))
    // Отрезки пишутся с нуля, а KPI считается по окну после разгона.
    expect(result.segments.some((s) => s.t0 < SIM_MODEL.warmupSec)).toBe(true)
    expect(result.queueByMinute).toHaveLength(60)
  })

  it('прогон 1 ч на 50 роботов считается быстрее секунды', () => {
    const started = performance.now()
    const result = runSimulation(input({ demand: { peakOpsPerHour: 400, avgRouteM: 120 } }, { count: 50 }))
    const spentMs = performance.now() - started
    expect(result.kpi.throughputPerHour).toBeGreaterThan(0)
    expect(spentMs).toBeLessThan(1000)
  })
})
