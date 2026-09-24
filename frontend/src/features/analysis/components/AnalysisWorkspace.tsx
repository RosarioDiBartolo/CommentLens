import type { ReactNode } from 'react'
import type { useAnalysis } from '../useAnalysis'
import Brand from './Brand'
import TopicResults from './TopicResults'
import DecisionSignals, { CommentDecisions } from './DecisionSignals'
import styles from './analysis.module.css'

interface PanelProps {
  title: string
  waiting: boolean
  pending: boolean
  error?: string
  hasData: boolean
  canRetry: boolean
  onRetry: () => void
  retryLabel: string
  children: ReactNode
}

function AnalysisPanel({ title, waiting, pending, error, hasData, canRetry, onRetry, retryLabel, children }: PanelProps) {
  return <section className={styles['analysis-panel']} aria-label={title}>
    <h2 className={styles['section-title']}>{title}</h2>
    {waiting && <p role="status" className={styles['panel-status']}>Waiting for comments…</p>}
    {!waiting && pending && <p role="status" className={styles['panel-status']}>{hasData ? 'Updating' : 'Running'} {title.toLowerCase()}…</p>}
    {error && <p role="alert" className={styles['error-msg']}>{error}{hasData && ' Previous results are still shown.'}</p>}
    {error && canRetry && <button className={styles['show-comments']} onClick={onRetry}>{retryLabel}</button>}
    {!waiting && !pending && !error && !hasData && <p className={styles['comment-help']}>Waiting for a comment snapshot.</p>}
    {children}
  </section>
}

export default function AnalysisWorkspace({ analysis, onReset }: {
  analysis: ReturnType<typeof useAnalysis>; onReset: () => void
}) {
  const { snapshot, topics, opinions, preparing, prepareError } = analysis
  return <div className={styles['page']}>
    <header className={styles['results-header']}>
      <Brand />
      <button className={styles['new-analysis-btn']} onClick={onReset}>+ New analysis</button>
    </header>
    <main className={styles['workspace-body']}>
      <div className={styles['video-info']}>
        <p className={styles['eyebrow']}>Audience analysis</p>
        <h1 className={styles['video-title']}>{snapshot?.video_title ?? 'Analysis workspace'}</h1>
        {!snapshot && <p className={styles['submitted-url']}>{analysis.url}</p>}
        {snapshot && <p>{snapshot.cached ? 'Saved comments' : 'Comments updated'} · Last fetched{' '}
          <time dateTime={snapshot.fetched_at}>{new Date(snapshot.fetched_at).toLocaleString()}</time></p>}
        {preparing && <p role="status" className={styles['panel-status']}>Fetching comments for both analyses…</p>}
        {prepareError && <p role="alert" className={styles['error-msg']}>{prepareError}{snapshot && ' Previous results are still shown.'}</p>}
        {snapshot && <button className={styles['new-analysis-btn']} disabled={preparing} onClick={analysis.refresh}>Refresh comments</button>}
        {!snapshot && prepareError && <button className={styles['new-analysis-btn']} onClick={analysis.retryPreparation}>Retry fetching comments</button>}
      </div>
      <div className={styles['analysis-panels']}>
        <AnalysisPanel title="Topic discovery" waiting={preparing} pending={topics.pending}
          error={topics.error} hasData={!!topics.data} canRetry={!preparing && !topics.pending}
          onRetry={analysis.retryTopics} retryLabel="Retry topic analysis">
          {topics.data && <TopicResults results={topics.data} />}
        </AnalysisPanel>
        <AnalysisPanel title="Opinion analysis" waiting={preparing} pending={opinions.pending}
          error={opinions.error} hasData={!!opinions.data} canRetry={!preparing && !opinions.pending}
          onRetry={analysis.retryOpinions} retryLabel="Retry opinion analysis">
          {opinions.data && <>
            <DecisionSignals decisions={opinions.data.decisions} onRetry={opinions.error ? undefined : analysis.retryOpinions}
              retryDisabled={preparing || opinions.pending} />
            {opinions.data.decisions.comments.length > 0 && <details className={styles['opinion-comments']}>
              <summary>View classified comments ({opinions.data.decisions.comments.length})</summary>
              <ul className={styles['comment-list']}>
                {opinions.data.decisions.comments.map(comment => <li key={comment.comment_id} className={styles['comment-item']}>
                  <p className={styles['rep-text']}>{comment.text}</p>
                  <p className={styles['comment-meta']}>{comment.author || 'Unknown author'} · {comment.likes} likes</p>
                  <CommentDecisions answers={comment.answers} />
                </li>)}
              </ul>
            </details>}
          </>}
        </AnalysisPanel>
      </div>
    </main>
  </div>
}
