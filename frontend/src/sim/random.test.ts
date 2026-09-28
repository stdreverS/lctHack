import { describe, expect, it } from 'vitest'
import { exponentialInterval, mulberry32, randomBetween, weightedIndex } from './random'

describe('mulberry32', () => {
  it('одинаковый seed — одинаковая последовательность', () => {
    const a = mulberry32(2026)
    const b = mulberry32(2026)
    const first = Array.from({ length: 50 }, () => a())
    const second = Array.from({ length: 50 }, () => b())
    expect(first).toEqual(second)
  })

  it('разные seed — разные последовательности', () => {
    const a = Array.from({ length: 20 }, mulberry32(1))
    const b = Array.from({ length: 20 }, mulberry32(2))
    expect(a).not.toEqual(b)
  })

  it('значения лежат в [0, 1) и распределены равномерно', () => {
    const rng = mulberry32(7)
    const values = Array.from({ length: 5000 }, () => rng())
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    expect(avg).toBeGreaterThan(0.45)
    expect(avg).toBeLessThan(0.55)
  })
})

describe('randomBetween', () => {
  it('не выходит за границы', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const v = randomBetween(rng, 10, 20)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThan(20)
    }
  })
})

describe('exponentialInterval', () => {
  it('средний интервал близок к 1 / интенсивность', () => {
    const rng = mulberry32(11)
    const ratePerSec = 0.05 // 180 событий в час
    const values = Array.from({ length: 20000 }, () => exponentialInterval(rng, ratePerSec))
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    expect(avg).toBeGreaterThan(18)
    expect(avg).toBeLessThan(22)
    expect(Math.min(...values)).toBeGreaterThan(0)
  })

  it('нулевая интенсивность — событий нет', () => {
    expect(exponentialInterval(mulberry32(1), 0)).toBe(Infinity)
    expect(exponentialInterval(mulberry32(1), -1)).toBe(Infinity)
  })
})

describe('weightedIndex', () => {
  it('частоты соответствуют весам', () => {
    const rng = mulberry32(5)
    const counts = [0, 0, 0]
    for (let i = 0; i < 6000; i++) counts[weightedIndex(rng, [0.5, 0.3, 0.2])]!++
    expect(counts[0]! / 6000).toBeCloseTo(0.5, 1)
    expect(counts[1]! / 6000).toBeCloseTo(0.3, 1)
    expect(counts[2]! / 6000).toBeCloseTo(0.2, 1)
  })

  it('нулевые или пустые веса — первый вариант', () => {
    expect(weightedIndex(mulberry32(1), [])).toBe(0)
    expect(weightedIndex(mulberry32(1), [0, 0])).toBe(0)
  })
})
