// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClusterComments from './components/ClusterComments'
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

describe('analysis integration', () => {
  it('shows saved state, sends explicit refresh, and retains results on failure', async () => {
    const user = userEvent.setup()
    axios.post.mockResolvedValueOnce({ data: result }).mockRejectedValueOnce({
      response: { data: { error: 'YouTube quota exceeded.' } },
    })
    render(<App />)
    await user.type(screen.getByPlaceholderText('Paste a YouTube video URL...'), 'https://youtu.be/abcdefghijk')
    await user.click(screen.getByRole('button', { name: 'Analyse' }))
    expect(await screen.findByText('Saved tutorial')).toBeTruthy()
    expect(screen.getByText(/Saved analysis/)).toBeTruthy()
    expect(axios.post.mock.calls[0][1]).toEqual({ url: 'https://youtu.be/abcdefghijk', refresh: false })
    await user.click(screen.getByRole('button', { name: 'Most liked' }))
    expect(axios.post).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Refresh comments' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('YouTube quota exceeded'))
    expect(screen.getByText('Saved tutorial')).toBeTruthy()
    expect(axios.post.mock.calls[1][1].refresh).toBe(true)
  })

  it('renders an explicit empty state', async () => {
    const user = userEvent.setup()
    axios.post.mockResolvedValueOnce({ data: { ...result, clusters: [] } })
    render(<App />)
    await user.type(screen.getByPlaceholderText('Paste a YouTube video URL...'), 'abcdefghijk')
    await user.click(screen.getByRole('button', { name: 'Analyse' }))
    expect(await screen.findByText(/No clear topics/)).toBeTruthy()
  })
})


it('shows every cluster, including those beyond the first five', async () => {
  const user = userEvent.setup()
  axios.post.mockResolvedValueOnce({ data: { ...result, clusters: Array.from({ length: 7 }, (_, i) => ({
    ...result.clusters[0], cluster_id: i + 1, title: `Topic number ${i + 1}`,
  })) } })
  render(<App />)
  await user.type(screen.getByPlaceholderText('Paste a YouTube video URL...'), 'abcdefghijk')
  await user.click(screen.getByRole('button', { name: 'Analyse' }))
  expect(await screen.findByText('Topic number 7')).toBeTruthy()
  expect(screen.getAllByRole('group', { name: 'Comment order' })).toHaveLength(7)
})
