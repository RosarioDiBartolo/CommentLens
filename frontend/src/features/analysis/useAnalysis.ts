import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AnalysisError, analyzeVideo } from './api'
import type { Analysis, AnalysisRequest } from './model'

export function useAnalysis() {
  // The last successful result survives refresh errors; mutation.data does not.
  const [results, setResults] = useState<Analysis | null>(null)
  const request = useRef<AbortController | null>(null)
  const mutation = useMutation({
    mutationFn: async (variables: AnalysisRequest & { controller: AbortController }) => {
      const { controller, ...payload } = variables
      try { return await analyzeVideo(payload, controller.signal) }
      finally { if (request.current === controller) request.current = null }
    },
    retry: false,
    gcTime: 0,
    onSuccess: (data, variables) => {
      if (!variables.controller.signal.aborted) setResults(data)
    },
    onError: (error, variables) => {
      if (!variables.controller.signal.aborted && error instanceof AnalysisError && error.status === 400) setResults(null)
    },
  })
  useEffect(() => () => { request.current?.abort() }, [])

  function analyze(url: string, refresh = false) {
    if (!url.trim() || request.current) return
    const controller = new AbortController()
    request.current = controller
    mutation.mutate({ url: url.trim(), refresh, controller })
  }

  function reset() {
    request.current?.abort()
    request.current = null
    mutation.reset()
    setResults(null)
  }

  return { results, analyze, reset, loading: mutation.isPending, error: mutation.error?.message }
}
