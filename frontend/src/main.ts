import '@fontsource/golos-text/400.css'
import '@fontsource/golos-text/500.css'
import '@fontsource/golos-text/600.css'
import 'element-plus/dist/index.css'
import './styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import ru from 'element-plus/es/locale/lang/ru'

import App from './App.vue'
import router from './router'
import { useAppErrorStore } from './stores/appError'
import { describeError, isApiError } from './utils/errors'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: ru })

// Ошибки вне страниц (в самом App.vue и т. п.) — тот же экран ошибки, что и для страниц
app.config.errorHandler = (error) => useAppErrorStore(pinia).show(error)

// Не загрузился модуль страницы при переходе (сервер недоступен, приложение обновилось)
router.onError((error) => useAppErrorStore(pinia).show(error))

// Ошибка API, которую никто не обработал: страница работает дальше, но сообщение видно
window.addEventListener('unhandledrejection', (event) => {
  if (!isApiError(event.reason)) return
  const text = describeError(event.reason)
  ElMessage.error(`${text.title}. ${text.description}`)
})

app.mount('#app')
