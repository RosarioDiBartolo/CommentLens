import { expect, test } from '@playwright/test'

test('analysis, refresh failure, sorting and reset work in the browser', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let requests = 0
  await page.route('**/api/analyze/', async route => {
    requests++
    const payload = route.request().postDataJSON()
    expect(payload.url).toBe('https://youtu.be/abcdefghijk')
    if (payload.refresh) {
      await route.fulfill({ status: 503, json: { error: 'YouTube quota exceeded.' } })
      return
    }
    await route.fulfill({ json: {
      analysis_id: 1, video_id: 'abcdefghijk', video_title: 'Audience tutorial',
      fetched_at: '2026-09-20T10:00:00Z', cached: true,
      total_comments_fetched: 12, total_after_cleaning: 9,
      clusters: [{ cluster_id: 1, title: 'Tutorial questions', size: 9,
        avg_likes: 4, percentage: 100, comments: Array.from({ length: 9 }, (_, i) => ({
          comment_id: `id-${i}`, text: `Comment ${i}`, author: `Author ${i}`,
          likes: i, similarity: 1 - i / 10,
        })) }],
    } })
  })
  await page.goto('/')
  await page.screenshot({ path: testInfo.outputPath('input.png'), fullPage: true })
  await page.getByRole('textbox', { name: 'YouTube video URL' }).fill('https://youtu.be/abcdefghijk')
  await page.getByRole('textbox').press('Enter')
  await expect(page.getByRole('heading', { name: 'Audience tutorial' })).toBeVisible()
  await page.getByRole('button', { name: 'Most liked' }).click()
  await expect(page.getByRole('listitem').first()).toContainText('Comment 8')
  await page.getByRole('button', { name: /Show more/ }).click()
  await expect(page.getByRole('listitem')).toHaveCount(9)
  await page.getByRole('button', { name: 'Refresh comments' }).click()
  await expect(page.getByRole('alert')).toContainText('YouTube quota exceeded')
  await expect(page.getByRole('heading', { name: 'Audience tutorial' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('results.png'), fullPage: true })
  expect(requests).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '+ New analysis' }).click()
  await expect(page.getByRole('textbox')).toHaveValue('')
  expect(errors).toEqual([])
})

test('invalid server data produces a recoverable error', async ({ page }) => {
  await page.route('**/api/analyze/', route => route.fulfill({ json: { clusters: null } }))
  await page.goto('/')
  await page.getByRole('textbox').fill('abcdefghijk')
  await page.getByRole('button', { name: 'Analyse' }).click()
  await expect(page.getByRole('alert')).toContainText('invalid analysis')
  await expect(page.getByRole('button', { name: 'Analyse' })).toBeEnabled()
})
