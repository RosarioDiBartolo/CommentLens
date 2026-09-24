import { ExternalLink, RefreshCw } from 'lucide-react'
import type { useAnalysis } from '../useAnalysis'
import styles from './explorer.module.css'

export default function VideoOverviewCard({ analysis }: { analysis: ReturnType<typeof useAnalysis> }) {
  const { snapshot, topics, preparing, prepareError } = analysis
  return <section className={styles.overview} aria-label="Video overview">
    <p className={styles.eyebrow}>Audience analysis</p>
    <h1>{snapshot?.video_title ?? 'Analysis workspace'}</h1>
    {!snapshot && <p className={styles.help}>{analysis.url}</p>}
    {snapshot && <>
      <a className={styles.videoLink} href={`https://www.youtube.com/watch?v=${encodeURIComponent(snapshot.video_id)}`} target="_blank" rel="noreferrer">Watch video<ExternalLink size={13} aria-hidden="true" /></a>
      <dl className={styles.metrics}>
        <div><dt>Sampled</dt><dd>{snapshot.total_comments_fetched.toLocaleString()}</dd></div>
        <div><dt>Cleaned</dt><dd>{topics.data?.total_after_cleaning.toLocaleString() ?? '—'}</dd></div>
        <div><dt>Clusters</dt><dd>{topics.data?.clusters.length ?? '—'}</dd></div>
      </dl>
      <p className={styles.help}>{snapshot.cached ? 'Saved comments' : 'Comments updated'} · Last fetched <time dateTime={snapshot.fetched_at}>{new Date(snapshot.fetched_at).toLocaleString()}</time></p>
    </>}
    {preparing && <p role="status" className={styles.help}>Fetching comments for both analyses…</p>}
    {prepareError && <p role="alert" className={styles.error}>{prepareError}{snapshot && ' Previous results are still shown.'}</p>}
    {snapshot && <button className={styles.button} disabled={preparing} onClick={analysis.refresh}><RefreshCw size={14} aria-hidden="true" />Refresh comments</button>}
    {!snapshot && prepareError && <button className={styles.button} onClick={analysis.retryPreparation}>Retry fetching comments</button>}
  </section>
}
