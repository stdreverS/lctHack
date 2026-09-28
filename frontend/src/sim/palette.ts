// Цвета симуляции из дизайн-токенов: Canvas не понимает CSS-переменные,
// поэтому значения токенов читаются из документа (при их отсутствии — SIM_PALETTE).
import { SIM_PALETTE, type SimPalette } from './renderer'

export function readPalette(): SimPalette {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    background: read('--color-bg', SIM_PALETTE.background),
    surface: read('--color-surface', SIM_PALETTE.surface),
    border: read('--color-border', SIM_PALETTE.border),
    text: read('--color-text', SIM_PALETTE.text),
    textSecondary: read('--color-text-secondary', SIM_PALETTE.textSecondary),
    zones: {
      receiving: read('--color-zone-receiving', SIM_PALETTE.zones.receiving),
      storage: read('--color-zone-storage', SIM_PALETTE.zones.storage),
      picking: read('--color-zone-picking', SIM_PALETTE.zones.picking),
      shipping: read('--color-zone-shipping', SIM_PALETTE.zones.shipping),
      charging: read('--color-zone-charging', SIM_PALETTE.zones.charging),
      other: read('--color-zone-other', SIM_PALETTE.zones.other),
    },
    robots: {
      idle: read('--color-robot-idle', SIM_PALETTE.robots.idle),
      moving_empty: read('--color-robot-moving-empty', SIM_PALETTE.robots.moving_empty),
      moving_loaded: read('--color-robot-moving-loaded', SIM_PALETTE.robots.moving_loaded),
      handling: read('--color-robot-handling', SIM_PALETTE.robots.handling),
      charging: read('--color-robot-charging', SIM_PALETTE.robots.charging),
    },
    route: read('--color-accent', SIM_PALETTE.route),
  }
}
