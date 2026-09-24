import axios from 'axios'
import { z } from 'zod'
import { analysisSchema, snapshotSchema, opinionsSchema, type AnalysisRequest } from './model'

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

async function post<T>(path: string, request: unknown, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
  let data: unknown
  try {
    const response = await axios.post<unknown>(`${apiUrl}/api/${path}`, request, { signal })
    data = response.data
  } catch (error: unknown) {
    if (signal.aborted) throw error
    const failure = failureSchema.safeParse(error)
    throw new AnalysisError(
      failure.success && failure.data.response.data?.error || 'Unable to reach the analysis server. Please try again.',
      failure.success ? failure.data.response.status : undefined,
    )
  }
  const result = schema.safeParse(data)
  if (!result.success) throw new AnalysisError('The server returned an invalid analysis. Please try again.')
  return result.data
}

// Kept for integrations using the original combined endpoint.
export const analyzeVideo = (request: AnalysisRequest, signal: AbortSignal) => post('analyze/', request, analysisSchema, signal)
export const prepareAnalysis = (request: AnalysisRequest, signal: AbortSignal) => post('runs/', request, snapshotSchema, signal)
export const analyzeTopics = (runId: string, signal: AbortSignal) => post(`runs/${runId}/topics/`, {}, analysisSchema, signal)
export const analyzeOpinions = (runId: string, signal: AbortSignal) => post(`runs/${runId}/opinions/`, {}, opinionsSchema, signal)
