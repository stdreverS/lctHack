import { del, get, post, put } from './http'
import type { Project, ProjectInput, ProjectSummary } from '@/types/api'

const base = (id: string) => `/projects/${encodeURIComponent(id)}`

export function getProjects(): Promise<ProjectSummary[]> {
  return get<ProjectSummary[]>('/projects')
}

export function createProject(input: ProjectInput): Promise<Project> {
  return post<Project>('/projects', input)
}

export function getProject(id: string): Promise<Project> {
  return get<Project>(base(id))
}

export function updateProject(id: string, input: ProjectInput): Promise<Project> {
  return put<Project>(base(id), input)
}

export function deleteProject(id: string): Promise<void> {
  return del(base(id))
}

export function copyProject(id: string): Promise<Project> {
  return post<Project>(`${base(id)}/copy`)
}
