import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      // Фиксированный часовой пояс, чтобы тесты дат не зависели от машины
      env: { TZ: 'Europe/Moscow' },
    },
  }),
)
