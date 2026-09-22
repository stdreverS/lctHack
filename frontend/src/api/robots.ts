import { del, get, post, put } from './http'
import type { Robot, RobotInput, RobotListQuery } from '@/types/api'

export function getRobots(query: RobotListQuery = {}): Promise<Robot[]> {
  return get<Robot[]>('/robots', { ...query })
}

export function getRobot(id: string): Promise<Robot> {
  return get<Robot>(`/robots/${encodeURIComponent(id)}`)
}

export function createRobot(input: RobotInput): Promise<Robot> {
  return post<Robot>('/robots', input)
}

export function updateRobot(id: string, input: RobotInput): Promise<Robot> {
  return put<Robot>(`/robots/${encodeURIComponent(id)}`, input)
}

export function deleteRobot(id: string): Promise<void> {
  return del(`/robots/${encodeURIComponent(id)}`)
}
