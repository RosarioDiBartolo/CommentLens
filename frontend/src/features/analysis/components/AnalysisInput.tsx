import styles from './analysis.module.css'
import Brand from './Brand'

interface Props { url: string; setUrl: (url: string) => void; analyze: () => void; error?: string }

export default function AnalysisInput({ url, setUrl, analyze, error }: Props) {
  return (
    <div className={styles['page']}>
      <div className={styles['input-page']}>
        <Brand />
        <div className={styles['hero-section']}>
          <p className={styles['eyebrow']}>Audience Intelligence</p>
          <h1 className={styles['hero-title']}>
            What is your audience<br />
            <em className={styles['hero-em']}>really</em> saying?
          </h1>
          <p className={styles['hero-sub']}>
            Paste a YouTube URL. We’ll analyse a sample of its comments
            and surface exactly what your audience wants next.
          </p>

          <div className={styles['input-card']}>
            <form className={styles['input-wrapper']} onSubmit={event => { event.preventDefault(); analyze() }}>
              <svg className={styles['yt-icon']} viewBox="0 0 24 24" fill="#FF0000">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <input
                aria-label="YouTube video URL"
                className={styles['url-input']}
                type="text"
                placeholder="Paste a YouTube video URL..."
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              <button type="submit" className={styles['analyze-btn']} disabled={!url.trim()}>
                Analyse
              </button>
            </form>
            {error && <p className={styles['error-msg']} role="alert">{error}</p>}
            <p className={styles['input-note']}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 2a.75.75 0 110 1.5A.75.75 0 016 3zm0 2.5a.5.5 0 01.5.5v3a.5.5 0 01-1 0V6a.5.5 0 01.5-.5z" fill="#999"/>
              </svg>
              Public comments and embeddings are saved for faster repeat analysis.
            </p>
          </div>

          <div className={styles['stats-row']}>
            <div className={styles['stat']}>
              <span className={styles['stat-num']}>Up to 50</span>
              <span className={styles['stat-label']}>Comments analysed</span>
            </div>
            <div className={styles['stat-divider']}/>
            <div className={styles['stat']}>
              <span className={styles['stat-num']}>4–8</span>
              <span className={styles['stat-label']}>Topic clusters</span>
            </div>
            <div className={styles['stat-divider']}/>
            <div className={styles['stat']}>
              <span className={styles['stat-num']}>~40s</span>
              <span className={styles['stat-label']}>Average analysis time</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}