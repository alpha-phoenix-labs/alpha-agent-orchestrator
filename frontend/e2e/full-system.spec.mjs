import { expect, test } from '@playwright/test'

const routes = ['/', '/work-orders', '/evidence-audit', '/system-swarm']

for (const route of routes) {
  test(`${route} renders without client errors or write controls`, async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    const response = await page.goto(route, { waitUntil: 'networkidle' })
    expect(response?.ok()).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Operations Console' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
    await expect(page.getByLabel('Active context')).toContainText('UNAVAILABLE')
    expect(await page.locator('button, input, textarea, select').count()).toBe(0)
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
