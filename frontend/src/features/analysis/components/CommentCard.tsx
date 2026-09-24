import { MessageSquare, ThumbsUp } from 'lucide-react'
import type { Comment } from '../model'
import { CommentDecisions } from './DecisionSignals'
import styles from './analysis.module.css'

function relativeTime(date: string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]
  const [unit, divisor] = units.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1]
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / divisor), unit)
}

export default function CommentCard({ comment, representative }: { comment: Comment; representative: boolean }) {
  return <li className={styles['comment-item']}>
    {representative && <span className={styles['representative-badge']}>Most representative</span>}
    <div className={styles['comment-meta']}>
      <strong>{comment.author || 'Unknown author'}</strong>
      {comment.published_at ? <time dateTime={comment.published_at} title={new Date(comment.published_at).toLocaleString()}>{relativeTime(comment.published_at)}</time>
        : <span>Date unavailable</span>}
    </div>
    <p className={styles['rep-text']}>{comment.text}</p>
    <div className={styles['comment-meta']}>
      <span aria-label={`${comment.likes} likes`}><ThumbsUp size={13} aria-hidden="true" /> {comment.likes.toLocaleString()}</span>
      <span><MessageSquare size={13} aria-hidden="true" /> {comment.replies == null ? 'Replies unavailable' : `${comment.replies.toLocaleString()} replies`}</span>
    </div>
    <CommentDecisions answers={comment.decisions} />
  </li>
}
