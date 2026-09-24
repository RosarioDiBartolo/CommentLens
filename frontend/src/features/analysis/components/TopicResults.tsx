import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Network } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible'
import type { Analysis, Opinions, Sentiment } from '../model'
import { clusterColor, filterClusters, prepareClusters, type ClusterSort } from '../clusterView'
import ClusterCard from './ClusterCard'
import ClusterMap from './ClusterMap'
import ClusterToolbar from './ClusterToolbar'
import styles from './explorer.module.css'

export default function TopicResults({ results, opinions, overview, opinionPanel }: { results?: Analysis; opinions?: Opinions; overview?: ReactNode; opinionPanel?: ReactNode }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [sentiment, setSentiment] = useState<Sentiment | 'all'>('all')
  const [sort, setSort] = useState<ClusterSort>('volume')
  const [mapOpen, setMapOpen] = useState(() => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1001px)').matches)
  const clusters = useMemo(() => results ? prepareClusters(results, opinions) : [], [results, opinions])
  const filtered = filterClusters(clusters, search, sentiment, sort)
  const toggle = (id: number) => setExpanded(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const highlighted = hovered ?? focused
  return <div className={styles.layout}>
    <aside className={styles.sidebar}>
      {overview}
      {results && clusters.length > 0 && <Collapsible open={mapOpen} onOpenChange={setMapOpen} className={styles.mapPanel}>
        <CollapsibleTrigger className={styles.mapToggle}><Network size={16} aria-hidden="true" />Cluster map<ChevronDown size={16} aria-hidden="true" /></CollapsibleTrigger>
        <CollapsibleContent><ClusterMap clusters={clusters} visibleIds={new Set(filtered.map(c => c.cluster_id))} expanded={expanded}
          highlighted={highlighted} onToggle={toggle} onHover={setHovered} onFocus={setFocused} /></CollapsibleContent>
      </Collapsible>}
    </aside>
    <section className={styles.browser} aria-label="Cluster browser">
      <div className={styles.browserHeading}><h2>Explore clusters</h2><span>{clusters.length} topics</span></div>
      <ClusterToolbar search={search} onSearch={setSearch} sentiment={sentiment} onSentiment={setSentiment} sort={sort} onSort={setSort}
        hasExpanded={expanded.size > 0} onCollapse={() => setExpanded(new Set())} />
      <div className={styles.clusterList}>
        {!results ? <p className={styles.empty}>Your clusters will appear here when topic discovery finishes.</p>
          : !clusters.length ? <p className={styles.empty}>No clear topics were found in this sample. Try another video or refresh its comments.</p>
          : !filtered.length ? <div className={styles.empty}><p>No clusters match your filters.</p><button className={styles.button} onClick={() => { setSearch(''); setSentiment('all') }}>Clear filters</button></div>
          : filtered.map(cluster => <ClusterCard key={cluster.cluster_id} cluster={cluster} color={clusterColor(clusters.indexOf(cluster))}
            expanded={expanded.has(cluster.cluster_id)} highlighted={highlighted === cluster.cluster_id} onToggle={() => toggle(cluster.cluster_id)} onHover={setHovered} onFocus={setFocused} />)}
      </div>
      <footer className={styles.footer} aria-live="polite">{filtered.length} of {clusters.length} clusters · {filtered.reduce((sum, c) => sum + c.size, 0).toLocaleString()} comments in filtered clusters</footer>
    </section>
    <div className={styles.opinions}>{opinionPanel}</div>
  </div>
}
