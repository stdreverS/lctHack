// Схема объекта в PNG для шага «Экспорт»: план с зонами и, если модель уже прогнана,
// роботы и маршруты на выбранный момент. Рисуется тем же renderer, что и симуляция.
import type { Layout } from '@/types/api'
import { drawScene, frameAt, resizeCanvas, type Timeline } from './renderer'
import { readPalette } from './palette'
import { formatClock } from '@/utils/format'

/** Размер картинки, px: ширина фиксирована, высота — по пропорции плана в разумных пределах. */
export function schemeSize(layout: Pick<Layout, 'widthM' | 'heightM'>, widthPx = 1600): { width: number; height: number } {
  const ratio = Math.max(1, layout.heightM) / Math.max(1, layout.widthM)
  const height = Math.round(Math.min(widthPx, Math.max(widthPx * 0.4, widthPx * ratio)))
  return { width: widthPx, height }
}

export function renderSchemePng(options: {
  layout: Layout
  /** null — только план, без роботов. */
  timeline: Timeline | null
  timeSec: number
}): Promise<Blob | null> {
  const { width, height } = schemeSize(options.layout)
  const canvas = document.createElement('canvas')
  resizeCanvas(canvas, width, height, 1)
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  drawScene(ctx, {
    layout: options.layout,
    frames: options.timeline ? frameAt(options.timeline, options.timeSec) : [],
    timeSec: options.timeSec,
    widthPx: width,
    heightPx: height,
    dpr: 1,
    palette: readPalette(),
    ...(options.timeline ? { timeLabel: formatClock(options.timeSec) } : {}),
  })
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}
