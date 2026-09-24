// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClusterComments from './features/analysis/components/ClusterComments'
import App from './App'
import axios from 'axios'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

const comments = Array.from({ length: 9 }, (_, i) => ({
  comment_id: `id-${i}`, text: `Comment text ${i}`, author: `Author ${i}`,
  likes: i * 10, similarity: 1 - i / 10,
}))
const result = {
  analysis_id: 1, video_id: 'abcdefghijk', video_title: 'Saved tutorial',
  fetched_at: '2026-09-20T10:00:00Z', total_comments_fetched: 12,
  total_after_cleaning: 9, cached: true,
  clusters: [{ cluster_id: 1, size: 9, title: 'Topic: Tutorial', avg_likes: 40,
    percentage: 100, comments }],
}

describe('cluster comments', () => {
  it('shows the representative plus five closest, with authors and likes', () => {
    render(<ClusterComments comments={comments} />)
    const list = screen.getByRole('list', { name: 'Most representative comments' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(6)
    expect(items[0].textContent).toContain('Comment text 0')
    expect(within(items[0]).getByText('Most representative')).toBeTruthy()
    expect(within(items[0]).getByText('Author 0')).toBeTruthy()
    expect(within(items[0]).getByLabelText('0 likes')).toBeTruthy()
  })

  it('switches to likes, paginates without duplicates, and resets when switching', async () => {
    const user = userEvent.setup()
    render(<ClusterComments comments={comments} />)
    await user.click(screen.getByRole('button', { name: 'Most liked' }))
    let list = screen.getByRole('list', { name: 'Most liked comments' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(within(list).getAllByRole('listitem')[0].textContent).toContain('Comment text 8')
    expect(within(list).getByLabelText('80 likes')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Show more/ }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(9)
    await user.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: 'Most representative' }))
    list = screen.getByRole('list', { name: 'Most representative comments' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('handles small clusters and deterministic ties', async () => {
    const user = userEvent.setup()
    render(<ClusterComments comments={[
      { ...comments[0], comment_id: 'b', text: 'Second tied comment' },
      { ...comments[0], comment_id: 'a', text: 'First tied comment' },
    ]} />)
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('First tied comment')
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Most liked' }))
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('First tied comment')
  })
})

const runId = '123e4567-e89b-42d3-a456-426614174000'
const snapshot = { run_id: runId, video_id: result.video_id, video_title: result.video_title,
  fetched_at: result.fetched_at, total_comments_fetched: 12, cached: true }
const disabled = { decisions: { status: 'disabled', summary: { count: 0 }, comments: [] } }
function mockFlow(topicResult = result) {
  axios.post.mockImplementation(async (path, payload) => {
    if (path.endsWith('/runs/')) {
      if (payload.refresh) throw { response: { data: { error: 'YouTube quota exceeded.' } } }
      return { data: snapshot }
    }
    return { data: path.endsWith('/topics/') ? topicResult : disabled }
  })
}
async function submit() {
  const user = userEvent.setup()
  render(<App />)
  await user.type(screen.getByRole('textbox'), 'https://youtu.be/abcdefghijk')
  await user.click(screen.getByRole('button', { name: 'Analyse' }))
  return user
}

it('shows independent panels and retains results on failed comment refresh', async () => {
  mockFlow()
  const user = await submit()
  expect(await screen.findByText('Topic: Tutorial')).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Topic discovery' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Opinion analysis' })).toBeTruthy()
  expect(screen.queryByRole('progressbar')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Refresh comments' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('YouTube quota exceeded'))
  expect(screen.getByText('Topic: Tutorial')).toBeTruthy()
  expect(axios.post.mock.calls.filter(([path]) => path.endsWith('/topics/'))).toHaveLength(1)
  expect(axios.post.mock.calls.filter(([path]) => path.endsWith('/opinions/'))).toHaveLength(1)
})

it('shows empty topics and every cluster without truncating the result', async () => {
  mockFlow({ ...result, clusters: [] })
  const user = await submit()
  expect(await screen.findByText(/No clear topics/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '+ New analysis' }))
  mockFlow({ ...result, clusters: Array.from({ length: 7 }, (_, i) => ({
    ...result.clusters[0], cluster_id: i + 1, title: `Topic number ${i + 1}`,
  })) })
  await user.type(screen.getByRole('textbox'), 'abcdefghijk')
  await user.click(screen.getByRole('button', { name: 'Analyse' }))
  expect(await screen.findByText('Topic number 7')).toBeTruthy()
})
