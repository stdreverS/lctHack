// Сбой приложения, который не обработала страница: ошибка отрисовки, не загрузившийся модуль
// маршрута. App.vue показывает вместо страницы понятное сообщение — не белый экран.
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useAppErrorStore = defineStore('appError', () => {
  const error = shallowRef<unknown>(null)

  function show(value: unknown): void {
    console.error(value)
    error.value = value ?? new Error('Неизвестная ошибка')
  }

  function clear(): void {
    error.value = null
  }

  return { error, show, clear }
})
