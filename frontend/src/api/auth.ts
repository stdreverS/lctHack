import { post } from './http'
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/types/api'

export function login(request: LoginRequest): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/login', request)
}

export function register(request: RegisterRequest): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/register', request)
}
