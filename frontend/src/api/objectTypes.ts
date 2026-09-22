import { get } from './http'
import type { ObjectType } from '@/types/api'

export function getObjectTypes(): Promise<ObjectType[]> {
  return get<ObjectType[]>('/object-types')
}
