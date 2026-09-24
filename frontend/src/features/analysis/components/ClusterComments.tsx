import styles from './analysis.module.css'
import type { Comment } from '../model'
import { useState } from 'react'
import { CommentDecisions } from './DecisionSignals'

export default function ClusterComments({ comments }: { comments: Comment[] }) {
  const [order, setOrder] = useState('representative')
  const [limit, setLimit] = useState(6)
  const representative = [...comments].sort((a, b) =>
    b.similarity - a.similarity || a.comment_id.localeCompare(b.comment_id))
  const sorted = order === 'representative' ? representative : [...comments].sort((a, b) =>
    b.likes - a.likes || a.comment_id.localeCompare(b.comment_id))
  const shown = sorted.slice(0, limit)

  const selectOrder = (next: 'representative' | 'likes') => {
    setOrder(next)
    setLimit(next === 'representative' ? 6 : 5)
  }

  return (
    <div className={styles['cluster-comments']}>
      <div className={styles['comment-order']} role="group" aria-label="Comment order">
        <button type="button" aria-pressed={order === 'representative'}
          onClick={() => selectOrder('representative')}>Most representative</button>
        <button type="button" aria-pressed={order === 'likes'}
          onClick={() => selectOrder('likes')}>Most liked</button>
      </div>
      <p className={styles['comment-help']}>
        {order === 'representative'
          ? 'Closest to the topic centre first, followed by the next closest comments.'
          : 'Comments in this topic, ranked by like count.'}
      </p>
      <ol className={styles['comment-list']} aria-label={order === 'representative'
        ? 'Most representative comments' : 'Most liked comments'}>
        {shown.map((comment) => (
          <li key={comment.comment_id} className={styles['comment-item']}>
            {order === 'representative' && comment.comment_id === representative[0]?.comment_id && (
              <span className={styles['representative-badge']}>Most representative</span>
            )}
            <p className={styles['rep-text']}>{comment.text}</p>
            <div className={styles['comment-meta']}>
              <span>{comment.author || 'Unknown author'}</span>
              <span aria-label={`${comment.likes} likes`}>♥ {comment.likes.toLocaleString()}</span>

            </div>
            <CommentDecisions answers={comment.decisions} />
          </li>
        ))}
      </ol>
      {comments.length === 0 && <p className={styles['comment-help']}>No comments in this topic.</p>}
      {limit < comments.length && (
        <button type="button" className={styles['show-comments']} onClick={() => setLimit(limit + 5)}>
          Show more ({comments.length - shown.length} remaining)
        </button>
      )}
      {limit > (order === 'representative' ? 6 : 5) && (
        <button type="button" className={styles['show-comments']} onClick={() => setLimit(order === 'representative' ? 6 : 5)}>
          Show fewer
        </button>
      )}
    </div>
  )
}
