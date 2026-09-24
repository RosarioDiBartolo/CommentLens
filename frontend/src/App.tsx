import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAnalysis } from './features/analysis/useAnalysis'
import AnalysisInput from './features/analysis/components/AnalysisInput'
import AnalysisWorkspace from './features/analysis/components/AnalysisWorkspace'

function AnalysisPage() {
  const [url, setUrl] = useState('')
  const analysis = useAnalysis()
  if (analysis.url === null) return <AnalysisInput url={url} setUrl={setUrl} analyze={() => { void analysis.start(url) }} />
  return <AnalysisWorkspace analysis={analysis} onReset={() => { analysis.reset(); setUrl('') }} />
}

export default function App() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  }))
  return <QueryClientProvider client={client}><AnalysisPage /></QueryClientProvider>
}
