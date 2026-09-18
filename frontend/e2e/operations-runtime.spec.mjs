import { expect, test } from '@playwright/test'

const OPERATIONS_DEV_URL = 'http://127.0.0.1:4174'
const PREVIEW_TOKEN = 'phase4-e2e-preview-token'

test('mounted Operations session automatically reconnects, resyncs, and fails closed', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Single deterministic runtime scenario is exercised in Chromium.')

  const requests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/v1/operations/')) return
    requests.push({
      path: url.pathname,
      authorization: request.headers().authorization ?? null,
    })
  })

  await page.goto(`${OPERATIONS_DEV_URL}/?operationsPreview=read`)

  const unauthorized = await page.evaluate(async () => {
    const response = await fetch('/v1/operations/snapshot', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    return { status: response.status, body: await response.text() }
  })
  expect(unauthorized).toEqual({ status: 401, body: '' })

  await page.getByLabel('Development preview read token').fill(PREVIEW_TOKEN)
  await page.getByRole('button', { name: 'Connect read session' }).click()

  await page.getByRole('link', { name: 'Work Orders' }).click()
  await expect(page.getByLabel('Overview').getByText('git_commit', { exact: true })).toBeVisible()
  await expect(page.getByText('VERIFIED', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('READ_VALIDATED', { exact: true })).toBeVisible()
  await expect(page.getByText('code_writer', { exact: true })).toBeVisible()
  await expect(
    page.getByText('repo://alpha-phoenix-labs/alpha-agent-orchestrator/docs/phase4-shadow-observation', {
      exact: true,
    }).first(),
  ).toBeVisible()

  const context = page.getByRole('region', { name: 'Active context' })
  await expect(context).toContainText('UNAVAILABLE · UNAVAILABLE · STALE', { timeout: 15_000 })
  await expect(context).toContainText('System modeUNKNOWN')
  await expect(context).toContainText('RepositoryUNKNOWN')

  const authorizedRequests = requests.filter((entry) => entry.authorization === `Bearer ${PREVIEW_TOKEN}`)
  expect(authorizedRequests.map((entry) => entry.path)).toEqual([
    '/v1/operations/snapshot',
    '/v1/operations/events',
    '/v1/operations/snapshot',
    '/v1/operations/events',
    '/v1/operations/snapshot',
    '/v1/operations/events',
    '/v1/operations/snapshot',
  ])

  await expect(page.getByRole('status', { name: 'Development preview read session' })).toContainText('UNAVAILABLE')

  const persistence = await page.evaluate(() => ({
    localStorage: localStorage.length,
    sessionStorage: sessionStorage.length,
    cookie: document.cookie,
  }))
  expect(persistence).toEqual({
    localStorage: 0,
    sessionStorage: 0,
    cookie: '',
  })
})
