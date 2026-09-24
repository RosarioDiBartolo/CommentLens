import { expect, test } from '@playwright/test'

const runId = '123e4567-e89b-42d3-a456-426614174000'
const snapshot = { run_id: runId, video_id: 'abcdefghijk', video_title: 'Audience tutorial',
  fetched_at: '2026-09-20T10:00:00Z', cached: true, total_comments_fetched: 12 }
const topics = { ...snapshot, analysis_id: 1, total_after_cleaning: 9,
  clusters: [{ cluster_id: 1, title: 'Tutorial questions', size: 9, avg_likes: 4, percentage: 100,
    comments: Array.from({ length: 9 }, (_, i) => ({ comment_id: `id-${i}`, text: `Comment ${i}`,
      author: `Author ${i}`, likes: i, similarity: 1 - i / 10 })) }] }
const opinions = { decisions: { status: 'complete', total: 12, summary: { count: 12,
  signals: { sentiment: { positive: .8, neutral: .1, negative: .1 } } }, comments: [] } }
function gate() {
  let release!: () => void
  const promise = new Promise<void>(done => { release = done })
  return { promise, release }
}

test('opens immediately and shows topics while opinions are still running', async ({ page }, testInfo) => {
  const preparation = gate(), opinion = gate()
  const counts = { topics: 0, opinions: 0 }
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/runs/', async route => {
    await preparation.promise
    if (route.request().postDataJSON().refresh) {
      await route.fulfill({ status: 503, json: { error: 'YouTube quota exceeded.' } })
    } else await route.fulfill({ json: snapshot })
  })
  await page.route('**/topics/', async route => { counts.topics++; await route.fulfill({ json: topics }) })
  await page.route('**/opinions/', async route => { counts.opinions++; await opinion.promise; await route.fulfill({ json: opinions }) })
  await page.goto('/')
  await page.getByRole('textbox').fill('https://youtu.be/abcdefghijk')
  await page.getByRole('textbox').press('Enter')
  await expect(page.getByRole('heading', { name: 'Analysis workspace' })).toBeVisible()
  await expect(page.getByText('Waiting for comments…')).toHaveCount(2)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText(/Estimated progress/)).toHaveCount(0)
  preparation.release()
  await expect(page.getByRole('heading', { name: 'Tutorial questions' })).toBeVisible()
  await expect(page.getByText('Running opinion analysis…')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('independent-panels.png'), fullPage: true })
  opinion.release()
  await expect(page.getByText(/12 of 12 sampled comments/)).toBeVisible()
  await page.getByRole('button', { name: 'Most liked' }).click()
  await expect(page.getByRole('listitem').first()).toContainText('Comment 8')
  await page.getByRole('button', { name: /Show more/ }).click()
  await expect(page.getByRole('listitem')).toHaveCount(9)
  await page.getByRole('button', { name: 'Refresh comments' }).click()
  await expect(page.getByRole('alert')).toContainText('YouTube quota exceeded')
  await expect(page.getByRole('heading', { name: 'Tutorial questions' })).toBeVisible()
  await expect(page.getByText(/12 of 12 sampled comments/)).toBeVisible()
  expect(counts).toEqual({ topics: 1, opinions: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('completed-panels.png'), fullPage: true })
  await page.getByRole('button', { name: '+ New analysis' }).click()
  await expect(page.getByRole('textbox')).toHaveValue('')
  expect(errors).toEqual([])
})

test('opinions finish first and topic failure can be retried independently', async ({ page }) => {
  const topic = gate()
  let topicRequests = 0, opinionRequests = 0
  await page.route('**/api/runs/', route => route.fulfill({ json: snapshot }))
  await page.route('**/topics/', async route => {
    topicRequests++
    await topic.promise
    if (topicRequests === 1) await route.fulfill({ status: 503, json: { error: 'Topic model unavailable.' } })
    else await route.fulfill({ json: topics })
  })
  await page.route('**/opinions/', async route => { opinionRequests++; await route.fulfill({ json: opinions }) })
  await page.goto('/')
  await page.getByRole('textbox').fill('abcdefghijk')
  await page.getByRole('button', { name: 'Analyse' }).click()
  await expect(page.getByText(/12 of 12 sampled comments/)).toBeVisible()
  await expect(page.getByText('Running topic discovery…')).toBeVisible()
  topic.release()
  await expect(page.getByRole('region', { name: 'Topic discovery' }).getByRole('alert')).toContainText('Topic model unavailable')
  await page.getByRole('button', { name: 'Retry topic analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Tutorial questions' })).toBeVisible()
  expect(opinionRequests).toBe(1)
})

test('malformed topics do not hide successful opinions', async ({ page }) => {
  await page.route('**/api/runs/', route => route.fulfill({ json: snapshot }))
  await page.route('**/topics/', route => route.fulfill({ json: { clusters: null } }))
  await page.route('**/opinions/', route => route.fulfill({ json: opinions }))
  await page.goto('/')
  await page.getByRole('textbox').fill('abcdefghijk')
  await page.getByRole('button', { name: 'Analyse' }).click()
  await expect(page.getByRole('alert')).toContainText('invalid analysis')
  await expect(page.getByText(/12 of 12 sampled comments/)).toBeVisible()
})

test('partial opinion retry does not refetch comments or rerun topics', async ({ page }) => {
  let preparationRequests = 0, topicRequests = 0, opinionRequests = 0
  await page.route('**/api/runs/', async route => { preparationRequests++; await route.fulfill({ json: snapshot }) })
  await page.route('**/topics/', async route => { topicRequests++; await route.fulfill({ json: topics }) })
  await page.route('**/opinions/', async route => {
    opinionRequests++
    await route.fulfill({ json: opinionRequests === 1 ? { decisions: { ...opinions.decisions,
      status: 'partial', error: 'Opinion server interrupted.', summary: { count: 1 } } } : opinions })
  })
  await page.goto('/')
  await page.getByRole('textbox').fill('abcdefghijk')
  await page.getByRole('button', { name: 'Analyse' }).click()
  await page.getByRole('button', { name: 'Retry opinion analysis' }).click()
  await expect(page.getByText(/12 of 12 sampled comments/)).toBeVisible()
  expect(preparationRequests).toBe(1)
  expect(topicRequests).toBe(1)
  expect(opinionRequests).toBe(2)
})
