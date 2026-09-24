import { describe, expect, it } from 'vitest'
import { filterClusters, layoutClusters, prepareClusters } from './clusterView'
import type { Analysis, Opinions } from './model'

const result: Analysis = { analysis_id: 1, video_id: 'video', video_title: 'Video', fetched_at: '2026-09-20T00:00:00Z', cached: false,
  total_comments_fetched: 20, total_after_cleaning: 20, clusters: [
    { cluster_id: 1, title: 'Topic: Camera, Lens', size: 16, percentage: 80, avg_likes: 2,
      comments: [{ comment_id: 'a', text: 'Great camera', author: 'A', likes: 2, similarity: 1 }] },
    { cluster_id: 2, title: 'Audio', keywords: ['music'], size: 4, percentage: 20, avg_likes: 0, comments: [] },
  ] }
const opinions: Opinions = { decisions: { status: 'partial', summary: { count: 1 }, comments: [{
  comment_id: 'a', text: 'Great camera', author: 'A', likes: 2, answers: {
    sentiment: { label: 'positive', probabilities: { positive: .8, neutral: .1, negative: .1 } },
    stance: { label: 'none', probabilities: {} }, question: { label: 'no', probabilities: {} }, toxicity: { label: 'no', probabilities: {} },
  },
}] } }

describe('cluster presentation data', () => {
  it('joins opinions by ID without mutating topic data or guessing missing sentiment', () => {
    const clusters = prepareClusters(result, opinions)
    expect(clusters[0].sentiment).toBe('positive')
    expect(clusters[0].classifiedCount).toBe(1)
    expect(clusters[1].sentiment).toBe('unclassified')
    expect(result.clusters[0].comments[0].decisions).toBeUndefined()
    expect(clusters[0].keywords).toEqual(['Camera', 'Lens'])
    expect(clusters[1].keywordsDerived).toBe(false)
  })
  it('combines label/keyword search and sentiment filtering and sorts deterministically', () => {
    const clusters = prepareClusters(result, opinions)
    expect(filterClusters(clusters, ' LENS ', 'positive', 'volume').map(c => c.cluster_id)).toEqual([1])
    expect(filterClusters(clusters, 'music', 'all', 'volume').map(c => c.cluster_id)).toEqual([2])
    expect(filterClusters(clusters, '', 'negative', 'volume')).toEqual([])
    expect(filterClusters(clusters, '', 'all', 'sentiment').map(c => c.cluster_id)).toEqual([1, 2])
  })
  it('scales bubble area with volume and packs arbitrary cluster counts without overlap', () => {
    const layout = layoutClusters(result.clusters)
    expect(layout.nodes[0].r ** 2 / layout.nodes[1].r ** 2).toBeCloseTo(4)
    const many = layoutClusters(Array.from({ length: 60 }, (_, i) => ({ ...result.clusters[0], cluster_id: i, size: i })))
    for (const a of many.nodes) {
      expect(a.x - a.r).toBeGreaterThanOrEqual(0)
      expect(a.x + a.r).toBeLessThanOrEqual(520)
      expect(a.y + a.r).toBeLessThanOrEqual(many.height)
      for (const b of many.nodes.filter(b => b.id !== a.id)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r)
    }
  })
})
