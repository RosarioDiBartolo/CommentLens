import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAnalysis } from './features/analysis/useAnalysis'
import AnalysisInput from './features/analysis/components/AnalysisInput'
import AnalysisLoading from './features/analysis/components/AnalysisLoading'
import AnalysisResults from './features/analysis/components/AnalysisResults'

function AnalysisPage() {
  const [url, setUrl] = useState('')
  const { results, loading, error, analyze, reset } = useAnalysis()
  const submit = (refresh = false) => analyze(url, refresh)
  if (loading) return <AnalysisLoading />
  if (!results) return <AnalysisInput url={url} setUrl={setUrl} analyze={submit} error={error} />
  return <AnalysisResults results={results} error={error} analyze={submit}
    onReset={() => { reset(); setUrl('') }} />
}

export default function App() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  }))
  return <QueryClientProvider client={client}><AnalysisPage /></QueryClientProvider>
}
