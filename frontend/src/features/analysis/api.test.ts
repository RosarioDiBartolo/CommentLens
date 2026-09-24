import { afterEach, expect, it, vi } from 'vitest'
import axios from 'axios'
import { analyzeVideo } from './api'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))
afterEach(() => vi.clearAllMocks())
const request = { url: 'abcdefghijk', refresh: false }
const result = {
  analysis_id: 1, video_id: 'abcdefghijk', video_title: 'Tutorial',
  fetched_at: '2026-09-20T10:00:00+00:00', cached: true,
  total_comments_fetched: 12, total_after_cleaning: 9, clusters: [],
}

it('accepts Django timestamps, empty topics and disabled inference', async () => {
  vi.mocked(axios.post).mockResolvedValue({ data: { ...result,
    decisions: { status: 'disabled', summary: { count: 0, signals: {} } },
  } })
  const controller = new AbortController()
  expect((await analyzeVideo(request, controller.signal)).clusters).toEqual([])
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/analyze\/$/), request, { signal: controller.signal })
})

it.each([{ clusters: null }, { fetched_at: 'not-a-date' }, { total_after_cleaning: -1 }])(
  'rejects malformed successful responses: %j', async invalid => {
    vi.mocked(axios.post).mockResolvedValue({ data: { ...result, ...invalid } })
    await expect(analyzeVideo(request, new AbortController().signal)).rejects.toThrow('invalid analysis')
  },
)

it('preserves backend validation status and its safe error message', async () => {
  vi.mocked(axios.post).mockRejectedValue({ response: { status: 400, data: { error: 'Video unavailable.' } } })
  await expect(analyzeVideo(request, new AbortController().signal)).rejects.toMatchObject({ status: 400, message: 'Video unavailable.' })
})

it('does not expose unexpected transport error details', async () => {
  vi.mocked(axios.post).mockRejectedValue(new Error('internal transport details'))
  await expect(analyzeVideo(request, new AbortController().signal)).rejects.toThrow('Unable to reach the analysis server')
})
