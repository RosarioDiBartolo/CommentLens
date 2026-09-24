import styles from './analysis.module.css'
import type { Comment } from '../model'
import { useState } from 'react'
import CommentCard from './CommentCard'

export default function ClusterComments({ comments, total = comments.length }: { comments: Comment[]; total?: number }) {
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
      <p className={styles['comment-help']} aria-live="polite">Showing {shown.length} of {total} comments</p>
      <ol className={styles['comment-list']} aria-label={order === 'representative'
        ? 'Most representative comments' : 'Most liked comments'}>
        {shown.map((comment) => (
          <CommentCard key={comment.comment_id} comment={comment} representative={order === 'representative' && comment.comment_id === representative[0]?.comment_id} />
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
