import { describe, expect, it } from 'vitest'
import { schemeSize } from './snapshot'

describe('schemeSize', () => {
  it('высота по пропорции плана', () => {
    expect(schemeSize({ widthM: 100, heightM: 60 })).toEqual({ width: 1600, height: 960 })
  })
  it('вытянутый план не даёт слишком низкую или высокую картинку', () => {
    expect(schemeSize({ widthM: 200, heightM: 10 }).height).toBe(640)
    expect(schemeSize({ widthM: 10, heightM: 200 }).height).toBe(1600)
  })
  it('нулевые размеры не ломают расчёт', () => {
    expect(schemeSize({ widthM: 0, heightM: 0 }, 800)).toEqual({ width: 800, height: 800 })
  })
})
