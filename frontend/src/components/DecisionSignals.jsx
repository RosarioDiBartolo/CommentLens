const percent = value => `${Math.round(value * 100)}%`

export function SignalSummary({ summary }) {
  if (!summary?.count) return <p className="comment-help">No comments classified yet.</p>
  return <div className="decision-grid">
    {Object.entries(summary.signals).map(([signal, values]) => (
      <div className="decision-signal" key={signal}>
        <h4>{signal === 'question' ? 'Genuine question' : signal}</h4>
        <dl>{Object.entries(values).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{percent(value)}</dd></div>
        ))}</dl>
      </div>
    ))}
  </div>
}

export function CommentDecisions({ answers }) {
  if (!answers) return null
  return <details className="comment-decisions">
    <summary>Model signals · {answers.sentiment.label} · toxicity {answers.toxicity.label}</summary>
    <SignalSummary summary={{ count: 1, signals: Object.fromEntries(
      Object.entries(answers).map(([key, answer]) => [key, answer.probabilities])) }} />
  </details>
}

export default function DecisionSignals({ decisions, onRetry }) {
  if (!decisions) return null
  if (decisions.status === 'disabled') return <section className="decision-panel">
    <h3>Audience opinion signals</h3>
    <p className="comment-help">Opinion analysis is not enabled for this server.</p>
  </section>
  const incomplete = decisions.status !== 'complete'
  return <section className="decision-panel" aria-label="Audience opinion signals">
    <h3>Audience opinion signals</h3>
    {decisions.provider === 'mock' && <p className="demo-notice">Demo data — fixed examples, not predictions about these comments.</p>}
    <p className="comment-help">{decisions.summary.count} of {decisions.total ?? 0} sampled comments classified.
      {' '}Percentages are average model probabilities, not measured audience shares.
      {' '}Stance uses explicit agreement in the comment; the video transcript is not available.</p>
    {incomplete && <div role="status"><p>{decisions.error || 'Opinion analysis is incomplete.'} Topic results remain available.</p>
      <button className="show-comments" onClick={onRetry}>Retry opinion analysis</button></div>}
    <SignalSummary summary={decisions.summary} />
  </section>
}
