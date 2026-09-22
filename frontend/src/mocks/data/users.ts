import type { User } from '@/types/api'

export interface MockUser extends User {
  password: string
}

export const USER_ID = '6f1c2a3e-8b4d-4e21-9a57-1c0d3b2e4f01'
export const ADMIN_ID = '0a9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e02'

export const users: MockUser[] = [
  { id: USER_ID, email: 'user@demo.ru', name: 'Ирина Смирнова', role: 'user', password: 'Demo12345' },
  { id: ADMIN_ID, email: 'admin@demo.ru', name: 'Администратор каталога', role: 'admin', password: 'Admin12345' },
]

export function toPublicUser({ password: _password, ...user }: MockUser): User {
  return user
}
