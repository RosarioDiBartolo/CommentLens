import axios from 'axios'
import { z } from 'zod'
import { analysisSchema, type AnalysisRequest } from './model'

const apiUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_URL?.trim() ||
  'http://localhost:8000'
).replace(/\/+$/, '')

const failureSchema = z.object({ response: z.object({
  status: z.number().optional(), data: z.object({ error: z.string() }).optional(),
}) })

export class AnalysisError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AnalysisError'
    this.status = status
  }
}

export async function analyzeVideo(request: AnalysisRequest, signal: AbortSignal) {
  let data: unknown
  try {
    const response = await axios.post<unknown>(`${apiUrl}/api/analyze/`, request, { signal })
    data = response.data
  } catch (error: unknown) {
    if (signal.aborted) throw error
    const failure = failureSchema.safeParse(error)
    throw new AnalysisError(
      failure.success && failure.data.response.data?.error || 'Unable to reach the analysis server. Please try again.',
      failure.success ? failure.data.response.status : undefined,
    )
  }
  const result = analysisSchema.safeParse(data)
  if (!result.success) throw new AnalysisError('The server returned an invalid analysis. Please try again.')
  return result.data
}
