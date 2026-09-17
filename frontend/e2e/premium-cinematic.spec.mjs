import { expect, test } from '@playwright/test'

const operationalControlName = /approve|execute|deploy|unlock|enable writer|force/i

function overlaps(a, b) {
  if (!a || !b) return false
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

test('rebuilt swarm scene is structurally distinct while preserving authority boundaries', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Canonical premium visual verification runs in Chromium.')

  await page.setViewportSize({ width: 1440, height: 1000 })
  const response = await page.goto('/?visualQa=premium', { waitUntil: 'networkidle' })
  expect(response?.ok()).toBeTruthy()

  await expect(page.getByText('VISUAL QA FIXTURE · NOT LIVE AUTHORITY')).toBeVisible()
  await expect(page.getByLabel('Mission Control rail')).toBeVisible()

  const shellBackground = await page.locator('.operations-shell').evaluate((element) =>
    getComputedStyle(element, '::before').backgroundImage,
  )
  expect(shellBackground).not.toContain('alpha-ambient.webp')
  expect(shellBackground).toContain('radial-gradient')

  const topology = page.getByRole('region', { name: 'Live Topology' })
  await expect(topology).toBeVisible()
  await expect(topology.getByTestId('swarm-scene-ambient-svg')).toBeVisible()
  await expect(topology.locator('.swarm-scene__core')).toBeVisible()

  const topologyBackground = await topology.locator('.swarm-scene__viewport').evaluate((element) =>
    getComputedStyle(element).backgroundImage,
  )
  expect(topologyBackground).toContain('radial-gradient')
  expect(topologyBackground).not.toContain('alpha-city-grid.svg')
  expect(topology.locator('.alpha-topology-stage')).toHaveCount(0)
  expect(topology.locator('.alpha-topology-node')).toHaveCount(0)

  expect(await topology.locator('.swarm-scene__agent').count()).toBeGreaterThanOrEqual(6)
  expect(await topology.locator('[data-qa-only="true"]').count()).toBeGreaterThan(0)

  expect(await page.getByRole('button', { name: operationalControlName }).count()).toBe(0)
  expect(await page.locator('input, textarea, select').count()).toBe(0)

  const toolsBox = await topology.locator('.swarm-scene__tools').boundingBox()
  const agentBoxes = await topology.locator('.swarm-scene__agent').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }),
  )
  expect(agentBoxes.some((box) => overlaps(box, toolsBox))).toBe(false)

  const topologyBox = await topology.boundingBox()
  const secondaryBox = await page.locator('.alpha-command-secondary').boundingBox()
  expect(overlaps(topologyBox, secondaryBox)).toBe(false)

  const qaBannerBox = await page.locator('.visual-qa-fixture-banner').boundingBox()
  const commandDeckBox = await page.locator('.alpha-command-deck').boundingBox()
  expect(overlaps(qaBannerBox, commandDeckBox)).toBe(false)
})
