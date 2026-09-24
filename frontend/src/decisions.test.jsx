// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DecisionSignals, { CommentDecisions } from './features/analysis/components/DecisionSignals'

afterEach(cleanup)
const summary = { count: 2, signals: {
  sentiment: { positive: .7, neutral: .2, negative: .1 },
  stance: { agrees: .4, mixed: .1, disagrees: .1, unclear: .4 },
  question: { yes: .3, no: .7 }, toxicity: { low: .9, medium: .08, high: .02 },
} }

it('shows coverage, distributions and explicit demo context', () => {
  render(<DecisionSignals decisions={{ status: 'complete', provider: 'mock', total: 3, summary }} />)
  expect(screen.getByText(/2 of 3 sampled comments/)).toBeTruthy()
  expect(screen.getByText(/Demo data/)).toBeTruthy()
  expect(screen.getByText(/not measured audience shares/)).toBeTruthy()
  expect(screen.getByText('90%')).toBeTruthy()
  expect(screen.getByText('unclear')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('provides retry for partial inference without hiding completed signals', async () => {
  const retry = vi.fn()
  render(<DecisionSignals decisions={{ status: 'partial', provider: 'kev', total: 3,
    summary, error: 'Server unavailable.' }} onRetry={retry} />)
  expect(screen.getByRole('status').textContent).toContain('Topic results remain available')
  expect(screen.getByText('90%')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Retry opinion analysis' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

it('does not show fake zero percentages for unavailable or disabled inference', () => {
  const { rerender } = render(<DecisionSignals decisions={{ status: 'unavailable', summary: { count: 0 }, total: 3 }} />)
  expect(screen.getByText('No comments classified yet.')).toBeTruthy()
  expect(screen.queryByText('0%')).toBeNull()
  rerender(<DecisionSignals decisions={{ status: 'disabled' }} />)
  expect(screen.getByText(/not enabled/)).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('makes individual probabilities available for inspection', async () => {
  const answers = Object.fromEntries(Object.entries(summary.signals).map(([key, probabilities]) =>
    [key, { label: Object.keys(probabilities)[0], probabilities }]))
  render(<CommentDecisions answers={answers} />)
  await userEvent.click(screen.getByText(/Model signals/))
  expect(screen.getByText('90%')).toBeTruthy()
})
