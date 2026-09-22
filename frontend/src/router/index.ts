import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Только для вошедших пользователей. */
    auth?: boolean
    /** Только для указанной роли. */
    role?: 'admin'
    /** Заголовок вкладки браузера. */
    title?: string
  }
}

const APP_TITLE = 'Подбор роботизированных решений'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/PublicLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/views/HomeView.vue') },
        { path: 'login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: 'Вход' } },
        { path: 'register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { title: 'Регистрация' } },
        { path: 'catalog', name: 'catalog', component: () => import('@/views/CatalogView.vue'), meta: { title: 'Каталог роботов' } },
        { path: 'catalog/:id', name: 'robot', component: () => import('@/views/RobotView.vue'), meta: { title: 'Карточка робота' } },
        { path: 'demo', name: 'demo', component: () => import('@/views/DemoView.vue'), meta: { title: 'Оценка без регистрации' } },
      ],
    },
    {
      path: '/app',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { auth: true },
      children: [
        { path: '', redirect: { name: 'projects' } },
        { path: 'projects', name: 'projects', component: () => import('@/views/ProjectsView.vue'), meta: { title: 'Мои проекты' } },
        { path: 'projects/:id', name: 'project', component: () => import('@/views/ProjectView.vue'), meta: { title: 'Проект' } },
        { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: 'Профиль' } },
      ],
    },
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { auth: true, role: 'admin' },
      children: [
        { path: '', redirect: { name: 'admin-robots' } },
        { path: 'robots', name: 'admin-robots', component: () => import('@/views/AdminRobotsView.vue'), meta: { title: 'Управление каталогом' } },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/layouts/PublicLayout.vue'),
      children: [
        { path: '', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: 'Страница не найдена' } },
      ],
    },
  ],
})

// to.meta объединяет meta всех совпавших маршрутов, поэтому meta родителя действует на детей.
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.auth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.role === 'admin' && !auth.isAdmin) {
    ElMessage.warning('Недостаточно прав: раздел доступен только администратору')
    return { name: 'projects' }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} — ${APP_TITLE}` : APP_TITLE
})

export default router
