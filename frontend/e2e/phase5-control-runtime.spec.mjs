import { expect, test } from '@playwright/test'

const PHASE5_URL = 'http://127.0.0.1:4175'
const TOKEN = 'phase5-e2e-control-token'
const ORDER_ID = 'WO-PHASE5-UI-001'

test('Phase 5 browser flow requires exact Human Gate confirmations and renders backend Post Verify', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Single deterministic Phase-5 control runtime is exercised in Chromium.')

  const controlRequests = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/v1/sandbox-control/')) return
    controlRequests.push({
      method: request.method(),
      path: url.pathname,
      authorization: request.headers().authorization ?? null,
    })
  })

  await page.goto(`${PHASE5_URL}/work-orders?sandboxControl=phase5`, { waitUntil: 'networkidle' })

  const panel = page.getByRole('region', { name: 'Phase 5 · Human-Gated Sandbox Control' })
  await expect(panel).toBeVisible()

  const unauthorized = await page.evaluate(async () => {
    const response = await fetch('/v1/sandbox-control/state', { cache: 'no-store' })
    return { status: response.status, body: await response.text() }
  })
  expect(unauthorized).toEqual({ status: 401, body: '' })

  await page.getByLabel('Development sandbox control token').fill(TOKEN)
  await page.getByRole('button', { name: 'Connect sandbox control' }).click()

  await expect(panel.getByText('PENDING', { exact: true })).toBeVisible()
  await expect(panel.getByText(ORDER_ID, { exact: true }).first()).toBeVisible()
  await expect(panel.getByText('git_commit', { exact: true }).first()).toBeVisible()
  await expect(panel.getByText('sandbox-git://phase5-ui-proof', { exact: true }).first()).toBeVisible()
  await expect(panel.getByText('HIGH', { exact: true }).first()).toBeVisible()

  const approveButton = page.getByRole('button', { name: `Approve exact Work Order · ${ORDER_ID}` })
  await expect(approveButton).toBeDisabled()
  const approvalInput = page.getByLabel(`Type exactly: APPROVE ${ORDER_ID}`)
  await approvalInput.fill('YES')
  await expect(approveButton).toBeDisabled()
  await approvalInput.fill(`APPROVE ${ORDER_ID}`)
  await expect(approveButton).toBeEnabled()
  await approveButton.click()

  await expect(panel.getByText('APPROVED', { exact: true })).toBeVisible()
  const approvalId = await panel.locator('div').filter({ hasText: /^Approval ID/ }).locator('.font-mono').textContent()
  expect(approvalId).toMatch(/^APR-/)

  const executeButton = page.getByRole('button', { name: `Execute approved sandbox write · ${ORDER_ID}` })
  await expect(executeButton).toBeDisabled()
  const executionInput = page.getByLabel(`Type exactly: EXECUTE ${ORDER_ID}`)
  await executionInput.fill('EXECUTE')
  await expect(executeButton).toBeDisabled()
  await executionInput.fill(`EXECUTE ${ORDER_ID}`)
  await expect(executeButton).toBeEnabled()
  await executeButton.click()

  await expect(panel.getByText('CONSUMED', { exact: true })).toBeVisible()
  await expect(panel.getByText('COMPLETED', { exact: true })).toBeVisible()
  await expect(panel.getByText('PASSED', { exact: true })).toBeVisible()
  await expect(panel.getByText('POST_VERIFY_PASS', { exact: true })).toBeVisible()
  await expect(panel.getByText('SANDBOX_EXECUTION_OK', { exact: true })).toBeVisible()

  const persistence = await page.evaluate(() => ({
    localStorage: localStorage.length,
    sessionStorage: sessionStorage.length,
    cookie: document.cookie,
  }))
  expect(persistence).toEqual({ localStorage: 0, sessionStorage: 0, cookie: '' })

  const authorized = controlRequests.filter((entry) => entry.authorization === `Bearer ${TOKEN}`)
  expect(authorized.map((entry) => [entry.method, entry.path])).toEqual([
    ['GET', '/v1/sandbox-control/state'],
    ['POST', '/v1/sandbox-control/approve'],
    ['POST', '/v1/sandbox-control/execute'],
  ])
})
