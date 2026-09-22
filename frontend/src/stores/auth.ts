import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/types/api'

const TOKEN_KEY = 'auth.token'
const USER_KEY = 'auth.user'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function writeSession(token: string | null, user: User | null): void {
  try {
    if (token && user) {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  } catch {
    // localStorage недоступен (приватный режим) — сессия живёт до перезагрузки
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readToken())
  const user = ref<User | null>(token.value ? readUser() : null)

  const isLoggedIn = computed(() => token.value !== null && user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function setSession(response: AuthResponse): User {
    token.value = response.token
    user.value = response.user
    writeSession(response.token, response.user)
    return response.user
  }

  async function login(request: LoginRequest): Promise<User> {
    return setSession(await authApi.login(request))
  }

  async function register(request: RegisterRequest): Promise<User> {
    return setSession(await authApi.register(request))
  }

  function logout(): void {
    token.value = null
    user.value = null
    writeSession(null, null)
  }

  return { token, user, isLoggedIn, isAdmin, login, register, logout }
})
