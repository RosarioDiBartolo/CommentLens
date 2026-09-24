import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible'
import type { DisplayCluster } from '../clusterView'
import ClusterComments from './ClusterComments'
import { SignalSummary } from './DecisionSignals'
import styles from './explorer.module.css'

export default function ClusterCard({ cluster, color, expanded, highlighted, onToggle, onHover, onFocus }: {
  cluster: DisplayCluster; color: string; expanded: boolean; highlighted: boolean
  onToggle: () => void; onHover: (id: number | null) => void; onFocus: (id: number | null) => void
}) {
  return <Collapsible open={expanded} onOpenChange={onToggle} className={styles.cluster} data-highlighted={highlighted}
    style={{ '--cluster-color': color } as CSSProperties} onMouseEnter={() => onHover(cluster.cluster_id)} onMouseLeave={() => onHover(null)}
    onFocusCapture={() => onFocus(cluster.cluster_id)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) onFocus(null) }}>
    <h3><CollapsibleTrigger className={styles.clusterTrigger} aria-controls={`cluster-content-${cluster.cluster_id}`}>
      <span className={styles.dot} /><span className={styles.clusterTitle}>{cluster.title || `Topic ${cluster.cluster_id}`}
        <span className={styles.volumeTrack} aria-hidden="true"><span style={{ width: `${cluster.percentage}%` }} /></span>
      </span>
      <span className={styles.badge}>{cluster.sentiment}</span>
      <span className={styles.count}>{cluster.size.toLocaleString()}<small>comments</small></span>
      <span className={styles.percentage}>{cluster.percentage}%</span><ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
    </CollapsibleTrigger></h3>
    <div className={styles.keywords} aria-label="Keywords">
      {cluster.keywords.map((keyword, i) => <span key={`${keyword}-${i}`}>{keyword}</span>)}
      {!cluster.keywords.length && <small>Keywords unavailable</small>}
      {!!cluster.keywords.length && cluster.keywordsDerived && <small>From topic label</small>}
    </div>
    <CollapsibleContent id={`cluster-content-${cluster.cluster_id}`} className={styles.clusterContent}>
      <p className={styles.help}>{cluster.classifiedCount} of {cluster.size} comments classified · {cluster.avg_likes.toLocaleString()} average likes.
        {cluster.classifiedCount > 0 && ' Sentiment is the highest average model probability; ties are unclassified.'}</p>
      <ClusterComments comments={cluster.comments} total={cluster.size} />
      {cluster.decision_summary && cluster.decision_summary.count > 0 && <details><summary>Opinion signals for this topic</summary><SignalSummary summary={cluster.decision_summary} /></details>}
    </CollapsibleContent>
  </Collapsible>
}
