import { useMemo, type CSSProperties } from 'react'
import type { DisplayCluster } from '../clusterView'
import { clusterColor, layoutClusters } from '../clusterView'
import styles from './explorer.module.css'

export default function ClusterMap({ clusters, visibleIds, expanded, highlighted, onToggle, onHover, onFocus }: {
  clusters: DisplayCluster[]; visibleIds: Set<number>; expanded: Set<number>; highlighted: number | null
  onToggle: (id: number) => void; onHover: (id: number | null) => void; onFocus: (id: number | null) => void
}) {
  const layout = useMemo(() => layoutClusters(clusters), [clusters])
  return <>
    <div className={styles.mapScroll}>
      <svg viewBox={`0 0 520 ${layout.height}`} className={styles.map} role="group" aria-label="Interactive cluster map">
        <title>Cluster map: bubble area represents comment volume</title>
        {clusters.map((cluster, index) => {
          const node = layout.nodes.find(n => n.id === cluster.cluster_id)!
          const visible = visibleIds.has(cluster.cluster_id)
          const active = highlighted === cluster.cluster_id || expanded.has(cluster.cluster_id)
          return <g key={cluster.cluster_id} transform={`translate(${node.x}, ${node.y})`} role="button" tabIndex={visible ? 0 : -1}
            aria-label={`${cluster.title || `Topic ${cluster.cluster_id}`}: ${cluster.size} comments, ${cluster.sentiment}`}
            aria-expanded={expanded.has(cluster.cluster_id)} aria-disabled={!visible}
            aria-controls={`cluster-content-${cluster.cluster_id}`}
            data-active={active} data-filtered={!visible} className={styles.bubble}
            style={{ '--cluster-color': clusterColor(index) } as CSSProperties}
            onMouseEnter={() => { if (visible) onHover(cluster.cluster_id) }} onMouseLeave={() => onHover(null)}
            onFocus={() => onFocus(cluster.cluster_id)} onBlur={() => onFocus(null)}
            onClick={() => { if (visible) onToggle(cluster.cluster_id) }}
            onKeyDown={event => { if (visible && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onToggle(cluster.cluster_id) } }}>
            <title>{cluster.title} · {cluster.size} comments · {cluster.percentage}%</title>
            <circle r={Math.max(22, node.r) + 5} className={styles.focusRing} />
            <circle r={Math.max(22, node.r)} fill="transparent" stroke="none" />
            <circle r={node.r} className={styles.bubbleBody} />
            {node.r >= 38 && <text textAnchor="middle" dy="-12" className={styles.bubbleLabel}>
              {(cluster.title.replace(/^Topic:\s*/i, '').slice(0, Math.floor(node.r / 3)) || `Topic ${cluster.cluster_id}`)}
            </text>}
            <text textAnchor="middle" dy={node.r >= 38 ? '12' : '5'}>{cluster.size}</text>
          </g>
        })}
      </svg>
    </div>
    <p className={styles.help}>Area = comment volume. Position does not imply similarity. Select a bubble or topic to expand it.</p>
    <div className={styles.legend} aria-label="Cluster legend">
      {clusters.map((cluster, index) => <button key={cluster.cluster_id} disabled={!visibleIds.has(cluster.cluster_id)}
        aria-expanded={expanded.has(cluster.cluster_id)} onClick={() => onToggle(cluster.cluster_id)}
        aria-controls={`cluster-content-${cluster.cluster_id}`}
        onMouseEnter={() => onHover(cluster.cluster_id)} onMouseLeave={() => onHover(null)}
        onFocus={() => onFocus(cluster.cluster_id)} onBlur={() => onFocus(null)}
        data-active={highlighted === cluster.cluster_id || expanded.has(cluster.cluster_id)}
        style={{ '--cluster-color': clusterColor(index) } as CSSProperties}>
        <span className={styles.dot} /><span>{cluster.title || `Topic ${cluster.cluster_id}`}</span><strong>{cluster.size}</strong>
      </button>)}
    </div>
  </>
}
