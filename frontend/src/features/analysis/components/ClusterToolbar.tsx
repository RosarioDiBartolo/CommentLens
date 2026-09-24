import { Search, ListCollapse } from 'lucide-react'
import type { Sentiment } from '../model'
import type { ClusterSort } from '../clusterView'
import styles from './explorer.module.css'

export default function ClusterToolbar({ search, onSearch, sentiment, onSentiment, sort, onSort, onCollapse, hasExpanded }: {
  search: string; onSearch: (value: string) => void; sentiment: Sentiment | 'all'; onSentiment: (value: Sentiment | 'all') => void
  sort: ClusterSort; onSort: (value: ClusterSort) => void; onCollapse: () => void; hasExpanded: boolean
}) {
  return <div className={styles.toolbar}>
    <div className={styles.search}><Search size={16} aria-hidden="true" /><input aria-label="Search clusters" placeholder="Search labels or keywords…" value={search} onChange={e => onSearch(e.target.value)} /></div>
    <label className={styles.select}>Sentiment<select value={sentiment} onChange={e => onSentiment(e.target.value as Sentiment | 'all')}>
      <option value="all">All sentiments</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option><option value="unclassified">Unclassified</option>
    </select></label>
    <label className={styles.select}>Sort clusters<select value={sort} onChange={e => onSort(e.target.value as ClusterSort)}>
      <option value="volume">By volume</option><option value="sentiment">By sentiment</option>
    </select></label>
    <button className={styles.button} onClick={onCollapse} disabled={!hasExpanded}><ListCollapse size={16} aria-hidden="true" />Collapse all</button>
  </div>
}
