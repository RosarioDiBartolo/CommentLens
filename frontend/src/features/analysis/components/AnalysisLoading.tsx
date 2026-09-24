import styles from './analysis.module.css'
import { useEffect, useState } from 'react'
import Brand from './Brand'

const LOADING_STEPS = [
  'Reading audience conversations...',
  'Filtering repetitive comments...',
  'Mapping semantic similarity...',
  'Discovering recurring themes...',
  'Evaluating audience opinion signals...',
]

export default function AnalysisLoading() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Date.now() - started), 600)
    return () => clearInterval(timer)
  }, [])
  const loadingStep = Math.min(Math.floor(elapsed / 9000), LOADING_STEPS.length - 1)
  const loadingProgress = Math.min(Math.round(elapsed / 500), 95)
  return (
    <div className={styles['page']}>
      <div className={styles['loading-page']}>
        <Brand />
        <div className={styles['loading-content']}>
          <h2 className={styles['loading-title']}>Analysing audience conversations...</h2>

          <div className={styles['steps-list']}>
            {LOADING_STEPS.map((step, i) => (
              <div key={i} className={styles['step-row']}>
                <div
                  className={styles['step-dot']}
                  style={{
                    background: i < loadingStep ? '#3DAA7D' : i === loadingStep ? '#E8645A' : '#E8E8E8',
                    border: i === loadingStep ? '2px solid #E8645A' : '2px solid transparent',
                  }}
                >
                  {i < loadingStep && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                  {i === loadingStep && (
                    <div className={styles['spinner-dot'] + ' ' + styles['pulse']}/>
                  )}
                </div>
                <span
                  className={styles['step-label']}
                  style={{
                    color: i <= loadingStep ? '#2D2D2D' : '#BBBBBB',
                    fontWeight: i === loadingStep ? 500 : 400,
                  }}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>

          <div className={styles['progress-section']}>
            <div className={styles['progress-bar']}>
              <div className={styles['progress-fill']} style={{ width: `$Estimated progress: {loadingProgress}%` }}/>
            </div>
            <span className={styles['progress-text']}>{loadingProgress}%</span>
          </div>

          <p className={styles['loading-note']}>Opinion analysis can take a few minutes when enabled.</p>
        </div>
      </div>
    </div>
  )
}