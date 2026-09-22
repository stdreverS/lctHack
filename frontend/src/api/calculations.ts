import { get, getBlob, post } from './http'
import type { CalcRequest, CalcResult, CalculationRecord, CalculationSummary } from '@/types/api'

const base = (id: string) => `/calculations/${encodeURIComponent(id)}`

export function calculate(request: CalcRequest): Promise<CalcResult> {
  return post<CalcResult>('/calculations', request)
}

export function getProjectCalculations(projectId: string): Promise<CalculationSummary[]> {
  return get<CalculationSummary[]>(`/projects/${encodeURIComponent(projectId)}/calculations`)
}

export function getCalculation(id: string): Promise<CalculationRecord> {
  return get<CalculationRecord>(base(id))
}

// Файлы доступны только владельцу, а обычная ссылка не передаёт заголовок Authorization.
// Поэтому файл скачивается с токеном и отдаётся как object URL (в режиме моков — заглушка).
// Вызывающий код после использования освобождает URL: URL.revokeObjectURL(url).

export async function getReportPdfUrl(id: string): Promise<string> {
  return URL.createObjectURL(await getBlob(`${base(id)}/report.pdf`))
}

export async function getExportXlsxUrl(id: string): Promise<string> {
  return URL.createObjectURL(await getBlob(`${base(id)}/export.xlsx`))
}
