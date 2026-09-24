import { useState } from 'react'
import { prepareAnalysis, analyzeTopics, analyzeOpinions } from './api'
import { useAnalysisTask } from './useAnalysisTask'

export function useAnalysis() {
  const [url, setUrl] = useState<string | null>(null)
  const preparation = useAnalysisTask(prepareAnalysis)
  const topics = useAnalysisTask(analyzeTopics)
  const opinions = useAnalysisTask(analyzeOpinions)

  async function start(nextUrl: string, refresh = false) {
    if (!nextUrl.trim()) return
    setUrl(nextUrl.trim())
    const snapshot = await preparation.run({ url: nextUrl.trim(), refresh })
    if (!snapshot) return
    topics.reset()
    opinions.reset()
    // Deliberately do not await either branch before starting the other.
    void topics.run(snapshot.run_id)
    void opinions.run(snapshot.run_id)
  }

  function reset() {
    preparation.reset()
    topics.reset()
    opinions.reset()
    setUrl(null)
  }

  return {
    url, snapshot: preparation.data, preparing: preparation.pending, prepareError: preparation.error,
    topics, opinions, start, reset,
    refresh: () => { if (url) void start(url, true) },
    retryPreparation: () => { if (url) void start(url) },
    retryTopics: () => { if (preparation.data) void topics.run(preparation.data.run_id) },
    retryOpinions: () => { if (preparation.data) void opinions.run(preparation.data.run_id) },
  }
}
