// Детерминированный генератор случайных чисел для симуляции.
// Math.random() не подходит: один и тот же seed обязан давать один и тот же прогон,
// иначе результат нельзя воспроизвести и сравнить с расчётом.

/** Возвращает число в [0, 1). */
export type Random = () => number

/**
 * mulberry32 — 32-битный генератор: быстрый, без зависимостей, с периодом 2^32.
 * Качества распределения хватает для модели потока заявок.
 */
export function mulberry32(seed: number): Random {
  // Приводим к 32-битному целому: дробный или отрицательный seed тоже допустим.
  let state = Math.trunc(seed) >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Случайное число в [min, max). */
export function randomBetween(rng: Random, min: number, max: number): number {
  return min + rng() * (max - min)
}

/**
 * Интервал до следующего события пуассоновского потока, с.
 * ratePerSec ≤ 0 — событий нет (Infinity).
 */
export function exponentialInterval(rng: Random, ratePerSec: number): number {
  if (!(ratePerSec > 0)) return Infinity
  // 1 - u, чтобы не получить log(0) при u = 0.
  return -Math.log(1 - rng()) / ratePerSec
}

/** Индекс по весам: weights[i] — вес i-го варианта. Пустые или нулевые веса — 0. */
export function weightedIndex(rng: Random, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
  if (!(total > 0)) return 0
  let threshold = rng() * total
  for (let i = 0; i < weights.length; i++) {
    threshold -= Math.max(0, weights[i] ?? 0)
    if (threshold < 0) return i
  }
  return weights.length - 1
}
