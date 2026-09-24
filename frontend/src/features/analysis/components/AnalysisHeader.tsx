import { Plus } from 'lucide-react'
import Brand from './Brand'
import styles from './analysis.module.css'
export default function AnalysisHeader({ onReset }: { onReset: () => void }) {
  return <header className={styles['results-header']}><Brand /><button className={styles['new-analysis-btn']} onClick={onReset}><Plus size={15} aria-hidden="true" /> New analysis</button></header>
}
