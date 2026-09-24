// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { prepareAnalysis, analyzeTopics, analyzeOpinions } from './api'
import { useAnalysis } from './useAnalysis'
import type { Analysis, Opinions, Snapshot } from './model'

vi.mock('./api', () => ({ prepareAnalysis: vi.fn(), analyzeTopics: vi.fn(), analyzeOpinions: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const snapshot: Snapshot = { run_id: '123e4567-e89b-42d3-a456-426614174000', video_id: 'abcdefghijk',
  video_title: 'Tutorial', fetched_at: '2026-09-20T10:00:00Z', total_comments_fetched: 12, cached: true }
const topics: Analysis = { ...snapshot, analysis_id: 1, total_after_cleaning: 9, clusters: [] }
const opinions: Opinions = { decisions: { status: 'complete', total: 12, summary: { count: 12 }, comments: [] } }
beforeEach(() => {
  vi.mocked(prepareAnalysis).mockResolvedValue(snapshot)
  vi.mocked(analyzeTopics).mockResolvedValue(topics)
  vi.mocked(analyzeOpinions).mockResolvedValue(opinions)
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function setup() {
  const client = new QueryClient()
  return renderHook(useAnalysis, { wrapper: ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider> })
}

it('opens immediately, deduplicates preparation and cancels on unmount', async () => {
  vi.mocked(prepareAnalysis).mockImplementation(() => new Promise(() => {}))
  const { result, unmount } = setup()
  act(() => { void result.current.start(' video '); void result.current.start(' video ') })
  expect(result.current.url).toBe('video')
  await waitFor(() => expect(prepareAnalysis).toHaveBeenCalledTimes(1))
  const [request, signal] = vi.mocked(prepareAnalysis).mock.calls[0]
  expect(request).toEqual({ url: 'video', refresh: false })
  expect(analyzeTopics).not.toHaveBeenCalled()
  unmount()
  expect(signal.aborted).toBe(true)
})

it('renders topic data while opinion analysis is still pending', async () => {
  const opinion = deferred<Opinions>()
  vi.mocked(analyzeOpinions).mockReturnValue(opinion.promise)
  const { result } = setup()
  act(() => { void result.current.start('video') })
  await waitFor(() => expect(result.current.topics.data).toEqual(topics))
  expect(result.current.opinions.pending).toBe(true)
  await act(async () => opinion.resolve(opinions))
  await waitFor(() => expect(result.current.opinions.data).toEqual(opinions))
})

it('retains opinions when topics fail, and retries only topics', async () => {
  vi.mocked(analyzeTopics).mockRejectedValueOnce(new Error('Topics offline'))
  const { result } = setup()
  act(() => { void result.current.start('video') })
  await waitFor(() => expect(result.current.topics.error).toBe('Topics offline'))
  await waitFor(() => expect(result.current.opinions.data).toEqual(opinions))
  act(() => result.current.retryTopics())
  await waitFor(() => expect(result.current.topics.data).toEqual(topics))
  expect(analyzeOpinions).toHaveBeenCalledTimes(1)
  expect(prepareAnalysis).toHaveBeenCalledTimes(1)
})

it('retries only opinions and never automatically retries a failed request', async () => {
  vi.mocked(analyzeOpinions).mockRejectedValueOnce(new Error('Opinions offline'))
  const { result } = setup()
  act(() => { void result.current.start('video') })
  await waitFor(() => expect(result.current.opinions.error).toBe('Opinions offline'))
  expect(analyzeOpinions).toHaveBeenCalledTimes(1)
  act(() => result.current.retryOpinions())
  await waitFor(() => expect(result.current.opinions.data).toEqual(opinions))
  expect(analyzeTopics).toHaveBeenCalledTimes(1)
  expect(prepareAnalysis).toHaveBeenCalledTimes(1)
})

it('ignores late preparation after reset instead of launching orphan analyses', async () => {
  const preparing = deferred<Snapshot>()
  vi.mocked(prepareAnalysis).mockReturnValue(preparing.promise)
  const { result } = setup()
  act(() => { void result.current.start('video') })
  await waitFor(() => expect(prepareAnalysis).toHaveBeenCalledTimes(1))
  act(() => result.current.reset())
  await act(async () => preparing.resolve(snapshot))
  expect(result.current.url).toBeNull()
  expect(result.current.snapshot).toBeNull()
  expect(analyzeTopics).not.toHaveBeenCalled()
  expect(analyzeOpinions).not.toHaveBeenCalled()
})

it('aborts both branches and discards late results on reset', async () => {
  const topic = deferred<Analysis>(), opinion = deferred<Opinions>()
  vi.mocked(analyzeTopics).mockReturnValue(topic.promise)
  vi.mocked(analyzeOpinions).mockReturnValue(opinion.promise)
  const { result } = setup()
  act(() => { void result.current.start('video') })
  await waitFor(() => expect(analyzeOpinions).toHaveBeenCalledTimes(1))
  act(() => result.current.reset())
  expect(vi.mocked(analyzeTopics).mock.calls[0][1].aborted).toBe(true)
  expect(vi.mocked(analyzeOpinions).mock.calls[0][1].aborted).toBe(true)
  await act(async () => { topic.resolve(topics); opinion.resolve(opinions) })
  expect(result.current.topics.data).toBeNull()
  expect(result.current.opinions.data).toBeNull()
})

it('keeps both results on a failed fetch refresh and uses a new snapshot on success', async () => {
  const { result } = setup()
  act(() => { void result.current.start('video') })
  await waitFor(() => expect(result.current.opinions.data).toEqual(opinions))
  vi.mocked(prepareAnalysis).mockRejectedValueOnce(new Error('Quota exceeded'))
  act(() => result.current.refresh())
  await waitFor(() => expect(result.current.prepareError).toBe('Quota exceeded'))
  expect(result.current.topics.data).toEqual(topics)
  expect(result.current.opinions.data).toEqual(opinions)
  expect(analyzeTopics).toHaveBeenCalledTimes(1)
  const next = { ...snapshot, run_id: '123e4567-e89b-42d3-a456-426614174001' }
  vi.mocked(prepareAnalysis).mockResolvedValueOnce(next)
  act(() => result.current.refresh())
  await waitFor(() => expect(analyzeTopics).toHaveBeenCalledTimes(2))
  expect(vi.mocked(analyzeTopics).mock.calls[1][0]).toBe(next.run_id)
  expect(vi.mocked(analyzeOpinions).mock.calls[1][0]).toBe(next.run_id)
})
