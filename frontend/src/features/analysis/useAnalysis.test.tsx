// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { analyzeVideo } from './api'
import { useAnalysis } from './useAnalysis'

vi.mock('./api', async importOriginal => ({
  ...await importOriginal<typeof import('./api')>(), analyzeVideo: vi.fn(),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

function setup() {
  const client = new QueryClient()
  return renderHook(useAnalysis, { wrapper: ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider> })
}

it('deduplicates immediate submissions and aborts the request on unmount', async () => {
  vi.mocked(analyzeVideo).mockImplementation(() => new Promise(() => {}))
  const { result, unmount } = setup()
  act(() => { result.current.analyze(' video '); result.current.analyze(' video ') })
  await waitFor(() => expect(analyzeVideo).toHaveBeenCalledTimes(1))
  const [request, signal] = vi.mocked(analyzeVideo).mock.calls[0]
  expect(request).toEqual({ url: 'video', refresh: false })
  unmount()
  expect(signal.aborted).toBe(true)
})

it('never automatically retries a failed analysis', async () => {
  vi.mocked(analyzeVideo).mockRejectedValue(new Error('Unavailable'))
  const { result } = setup()
  act(() => result.current.analyze('video'))
  await waitFor(() => expect(result.current.error).toBe('Unavailable'))
  expect(analyzeVideo).toHaveBeenCalledTimes(1)
  expect(result.current.loading).toBe(false)
})
