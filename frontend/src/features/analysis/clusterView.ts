import type { Analysis, Cluster, Opinions, Sentiment } from './model'

export interface DisplayCluster extends Cluster {
  sentiment: Sentiment
  classifiedCount: number
  keywords: string[]
  keywordsDerived: boolean
}

export function prepareClusters(results: Analysis, opinions?: Opinions): DisplayCluster[] {
  const byId = new Map(opinions?.decisions.comments.map(c => [c.comment_id, c.answers]))
  return results.clusters.map(cluster => {
    const comments = cluster.comments.map(c => ({ ...c, decisions: byId.get(c.comment_id) ?? c.decisions }))
    const classified = comments.filter(c => c.decisions)
    const values = classified.length ? Object.fromEntries(['positive', 'neutral', 'negative'].map(label => [label,
      classified.reduce((sum, c) => sum + (c.decisions?.sentiment.probabilities[label] ?? 0), 0) / classified.length,
    ])) : cluster.decision_summary?.signals?.sentiment
    const ranked = Object.entries(values ?? {}).filter(([label]) => ['positive', 'neutral', 'negative'].includes(label))
      .sort((a, b) => b[1] - a[1])
    const sentiment: Sentiment = ranked.length && ranked[0][1] > 0 && ranked[0][1] !== ranked[1]?.[1]
      ? ranked[0][0] as Sentiment : 'unclassified'
    // The current API embeds its extracted keywords in "Topic: word, word" titles.
    // Do not invent NLP keywords from representative comment text.
    const titleKeywords = /^Topic:\s*/i.test(cluster.title)
      ? cluster.title.replace(/^Topic:\s*/i, '').split(',').map(s => s.trim()).filter(Boolean) : []
    return { ...cluster, comments, sentiment, classifiedCount: classified.length || cluster.decision_summary?.count || 0,
      keywords: cluster.keywords ?? titleKeywords, keywordsDerived: cluster.keywords === undefined }
  })
}

export type ClusterSort = 'volume' | 'sentiment'
export function filterClusters(clusters: DisplayCluster[], search: string, sentiment: Sentiment | 'all', sort: ClusterSort) {
  const query = search.trim().toLocaleLowerCase()
  const order: Record<Sentiment, number> = { positive: 0, neutral: 1, negative: 2, unclassified: 3 }
  return clusters.filter(c => (sentiment === 'all' || c.sentiment === sentiment) &&
    (!query || [c.title, ...c.keywords].some(s => s.toLocaleLowerCase().includes(query))))
    .sort((a, b) => (sort === 'sentiment' ? order[a.sentiment] - order[b.sentiment] : 0) || b.size - a.size || a.cluster_id - b.cluster_id)
}

export const clusterColor = (index: number) => `var(--cluster-${index % 5 + 1})`

// Deterministic shelf packing. Area, not radius, encodes volume; positions carry no semantic meaning.
// Keeping layout independent of filtering avoids moving targets during exploration.
export function layoutClusters(clusters: Cluster[]) {
  const max = Math.max(1, ...clusters.map(c => c.size))
  const nodes: { id: number; x: number; y: number; r: number }[] = []
  let x = 12, y = 12, rowHeight = 0
  for (const c of [...clusters].sort((a, b) => b.size - a.size || a.cluster_id - b.cluster_id)) {
    const r = 76 * Math.sqrt(c.size / max)
    const diameter = Math.max(44, r * 2) + 20
    if (x + diameter > 508) { x = 12; y += rowHeight; rowHeight = 0 }
    nodes.push({ id: c.cluster_id, x: x + diameter / 2, y: y + diameter / 2, r })
    x += diameter
    rowHeight = Math.max(rowHeight, diameter)
  }
  return { nodes, height: Math.max(220, y + rowHeight + 12) }
}
