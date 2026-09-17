import { expect, test } from '@playwright/test'

const routes = ['/', '/work-orders', '/evidence-audit', '/system-swarm']
const operationalControlName = /approve|execute|deploy|unlock|enable writer|force/i

for (const route of routes) {
  test(`${route} renders without client errors or operational write controls`, async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    const response = await page.goto(route, { waitUntil: 'networkidle' })
    expect(response?.ok()).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Operations Console' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
    await expect(page.getByLabel('Active context')).toContainText('UNAVAILABLE')

    const localeControls = page.getByRole('group', { name: 'Interface language' })
    await expect(localeControls).toBeVisible()
    expect(await page.getByRole('button', { name: operationalControlName }).count()).toBe(0)
    expect(await page.locator('button').count()).toBe(await localeControls.getByRole('button').count())
    expect(await page.locator('input, textarea, select').count()).toBe(0)
    expect(pageErrors).toEqual([])
  })
}

test('primary navigation reaches every current console route', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  const cases = [
    ['Work Orders', '/work-orders'],
    ['Evidence & Audit', '/evidence-audit'],
    ['System / Swarm', '/system-swarm'],
    ['Mission Control', '/'],
  ]

  for (const [label, path] of cases) {
    await page.getByRole('link', { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`))
    await expect(page.getByRole('heading', { name: 'Operations Console' })).toBeVisible()
  }
})

test('keyboard navigation exposes visible focus on interactive console controls', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  await page.keyboard.press('Tab')
  const englishLocale = page.getByRole('button', { name: 'English' })
  await expect(englishLocale).toBeFocused()

  const focusedStyle = await englishLocale.evaluate((element) => {
    const style = getComputedStyle(element)
    return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle }
  })
  expect(focusedStyle.boxShadow === 'none' && focusedStyle.outlineStyle === 'none').toBeFalsy()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Deutsch' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Mission Control' })).toBeFocused()
})

test('reduced-motion preference bounds transition duration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'networkidle' })

  const durationMs = await page.getByRole('link', { name: 'Mission Control' }).evaluate((element) => {
    const raw = getComputedStyle(element).transitionDuration.split(',')[0].trim()
    if (raw.endsWith('ms')) return Number.parseFloat(raw)
    if (raw.endsWith('s')) return Number.parseFloat(raw) * 1000
    return Number.POSITIVE_INFINITY
  })

  expect(durationMs).toBeLessThanOrEqual(0.02)
})

test('safety-critical authority state remains visible on narrow and desktop layouts', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/', { waitUntil: 'networkidle' })

    const activeContext = page.getByLabel('Active context')
    await expect(activeContext).toBeVisible()
    await expect(activeContext).toContainText('UNAVAILABLE')
    await expect(activeContext).toContainText('UNKNOWN')
    await expect(page.getByLabel('Mission Control rail')).toBeVisible()
  }
})
