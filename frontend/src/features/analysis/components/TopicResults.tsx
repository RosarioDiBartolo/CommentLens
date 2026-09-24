import styles from './analysis.module.css'
import ClusterComments from './ClusterComments'
import { SignalSummary } from './DecisionSignals'
import type { Analysis } from '../model'

const CLUSTER_COLORS = [
  { border: '#E8645A', numColor: '#E8645A', numBg: '#FFF5F4', badge: '#FFE8E6', badgeText: '#C0392B' },
  { border: '#F0A500', numColor: '#F0A500', numBg: '#FFFBF0', badge: '#FFF3CD', badgeText: '#8B6200' },
  { border: '#7B68EE', numColor: '#7B68EE', numBg: '#F8F7FF', badge: '#EDEDFF', badgeText: '#3D35A0' },
  { border: '#3DAA7D', numColor: '#3DAA7D', numBg: '#F4FBF8', badge: '#E0F5EC', badgeText: '#1A6B4A' },
  { border: '#E87D5A', numColor: '#E87D5A', numBg: '#FFF7F4', badge: '#FFE8DC', badgeText: '#A03A1A' },
]

function getEngagement(avgLikes: number) {
  if (avgLikes >= 5) return { label: 'High', color: '#3DAA7D', arrow: '↑' }
  if (avgLikes >= 2) return { label: 'Medium', color: '#F0A500', arrow: '→' }
  return { label: 'Low', color: '#999', arrow: '↓' }
}

interface Props { results: Analysis }

export default function TopicResults({ results }: Props) {
  const totalFetched = results?.total_comments_fetched || 0;
  const totalCleaned = results?.total_after_cleaning || 0;
  const spamFiltered = totalFetched - totalCleaned;
  const spamPercentage = totalFetched > 0 ? Math.round((spamFiltered / totalFetched) * 100) : 0;

  return (
    <>
        <div className={styles['metrics-row']}>
          <div className={styles['metric-card']}>
            <div className={styles['metric-icon']}>💬</div>
            <div>
              <p className={styles['metric-num']}>{totalFetched}</p>
              <p className={styles['metric-label']}>Total Comments</p>
              <p className={styles['metric-sub']}>Sampled from this video</p>
            </div>
          </div>
          
          <div className={styles['metric-card']}>
            <div className={styles['metric-icon']}>🛡️</div>
            <div>
              <p className={styles['metric-num']}>{spamFiltered}</p>
              <p className={styles['metric-label']}>Filtered Comments</p>
              <p className={styles['metric-sub']}>{spamPercentage}% noise filtered</p>
            </div>
          </div>

          <div className={styles['metric-card']}>
            <div className={styles['metric-icon']}>✨</div>
            <div>
              <p className={styles['metric-num']}>{totalCleaned}</p>
              <p className={styles['metric-label']}>Signal Comments</p>
              <p className={styles['metric-sub']}>Used for topic discovery</p>
            </div>
          </div>

          <div className={styles['metric-card']}>
            <div className={styles['metric-icon']}>🔍</div>
            <div>
              <p className={styles['metric-num']}>{results.clusters.length}</p>
              <p className={styles['metric-label']}>Topics Found</p>
              <p className={styles['metric-sub']}>Ranked by impact</p>
            </div>
          </div>
        </div>



        <div className={styles['clusters-section']}>
          <div className={styles['section-header']}>
            <span className={styles['sparkle']}>✦</span>
            <h3 className={styles['section-title']}>Top Audience Signals</h3>
          </div>

          {results.clusters.length === 0 && <p className={styles['comment-help']}>No clear topics were found in this sample. Try another video or refresh its comments.</p>}
          <div className={styles['clusters-list']}>
            {results.clusters.map((cluster, idx) => {
              const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length]
              const engagement = getEngagement(cluster.avg_likes)

              return (
                <div
                  key={cluster.cluster_id}
                  className={styles['cluster-card']}
                  style={{ borderLeftColor: color.border }}
                >
                  <div className={styles['cluster-top']}>
                    <div
                      className={styles['cluster-num']}
                      style={{ color: color.numColor, background: color.numBg }}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </div>

                    <div className={styles['cluster-main']}>
                      <div className={styles['cluster-title-row']}>
                        <h4 className={styles['cluster-title']}>
                          {cluster.title || `Topic Signal #${idx + 1}`}
                        </h4>
                        
                        <span
                          className={styles['percent-badge']}
                          style={{ background: color.badge, color: color.badgeText }}
                        >
                          {cluster.percentage}% of comments
                        </span>
                      </div>

                      <p className={styles['cluster-sub']}>
                        {cluster.size} comments in this topic cluster
                      </p>

                      <ClusterComments
                        key={`${results.analysis_id}-${cluster.cluster_id}`}
                        comments={cluster.comments || []}
                      />
                      {cluster.decision_summary && cluster.decision_summary.count > 0 && <details className={styles['topic-decisions']}>
                        <summary>Opinion signals for this topic ({cluster.decision_summary.count}/{cluster.size} comments)</summary>
                        <SignalSummary summary={cluster.decision_summary} />
                      </details>}
                    </div>

                    <div className={styles['cluster-stats']}>
                      <div className={styles['engagement-box']}>
                        <p className={styles['eng-label']}>Engagement</p>
                        <p className={styles['eng-value']} style={{ color: engagement.color }}>
                          {engagement.label} {engagement.arrow}
                        </p>
                      </div>
                      <div className={styles['engagement-box']}>
                        <p className={styles['eng-label']}>Avg. Likes</p>
                        <p className={styles['eng-num']}>{cluster.avg_likes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

    </>
  )
}
