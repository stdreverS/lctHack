import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Локальная разработка с бэкендом: VITE_USE_MOCKS=false npm run dev, Robo.Api на :5203
  // (dotnet run --launch-profile http). Запросы идут с того же адреса — CORS не нужен.
  server: {
    proxy: {
      // Если API не запущен, Vite отвечает 502 — фронтенд покажет «Нет связи с сервером»
      '/api': { target: 'http://localhost:5203', changeOrigin: true },
    },
  },
})
