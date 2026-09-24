import styles from './analysis.module.css'
function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke="#2D2D2D" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="6" stroke="#2D2D2D" strokeWidth="1.5"/>
      <circle cx="14" cy="14" r="2" fill="#2D2D2D"/>
      <line x1="14" y1="1" x2="14" y2="6" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14" y1="22" x2="14" y2="27" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="14" x2="6" y2="14" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="22" y1="14" x2="27" y2="14" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function Brand() {
  return (
    <div className={styles['brand']}>
      <div className={styles['logo-mark']}><Logo size={22}/></div>
      <span className={styles['brand-name']}>CommentLens</span>
    </div>
  )
}

