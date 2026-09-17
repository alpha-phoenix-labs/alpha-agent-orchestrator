import { expect, test } from '@playwright/test'

const operationalControlName = /approve|execute|deploy|unlock|enable writer|force/i

test('premium cinematic layer uses repository-owned ambience without changing authority semantics', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Canonical premium visual verification runs in Chromium.')

  await page.setViewportSize({ width: 1440, height: 1000 })
  const response = await page.goto('/?visualQa=premium', { waitUntil: 'networkidle' })
  expect(response?.ok()).toBeTruthy()

  await expect(page.getByText('VISUAL QA FIXTURE · NOT LIVE AUTHORITY')).toBeVisible()
  await expect(page.getByLabel('Mission Control rail')).toBeVisible()

  const shellBackground = await page.locator('.operations-shell').evaluate((element) =>
    getComputedStyle(element, '::before').backgroundImage,
  )
  expect(shellBackground).not.toContain('alphan-ambient.webp')
  expect(shellBackground).toContain('radial-gradient')

  const topology = page.getByRole('region', { name: 'Live Topology' })
  await expect(topology).toBeVisible()
  await expect(topology.getByTestId('swarm-topology-svg')).toBeVisible()

  const topologyBackground = await topology.locator('.alphan-topology-stage').evaluate((element) =>
    getComputedStyle(element).backgroundImage,
  )
  expect(topologyBackground).toContain('alphan-city-grid.svg')
  expect(topologyBackground).toContain('alphan-ambient.svg')
  expect(topologyBackground).not.toContain('alphan-ambient.webp')

  expect(await topology.locator('.alphan-topology-node').count()).toBeGreaterThanOrEqual(7)
  expect(await topology.locator('[data-qa-only="true"]').count()).toBeGreaterThan(0)

  expect(await page.getByRole('button', { name: operationalControlName }).count()).toBe(0)
  expect(await page.locator('input, textarea, select').count()).toBe(0)
})
