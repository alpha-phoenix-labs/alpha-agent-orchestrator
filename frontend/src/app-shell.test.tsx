import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

import { routes } from './App'
import { OperationsDataProvider } from './operations-data'

function renderShell(initialEntry = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] })
  render(
    <OperationsDataProvider>
      <RouterProvider router={router} />
    </OperationsDataProvider>,
  )
  return router
}

describe('Phase 4.4 app shell', () => {
  it('renders the four required primary navigation targets', () => {
    renderShell()

    const nav = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(nav).toHaveTextContent('Mission Control')
    expect(nav).toHaveTextContent('Work Orders')
    expect(nav).toHaveTextContent('Evidence & Audit')
    expect(nav).toHaveTextContent('System / Swarm')
  })

  it('fails closed when no authoritative backend snapshot is present', () => {
    renderShell()

    const context = screen.getByRole('region', { name: 'Active context' })
    expect(context).toHaveTextContent('UNAVAILABLE')
    expect(context).toHaveTextContent('System modeUNKNOWN')
    expect(context).toHaveTextContent('RepositoryUNKNOWN')
    expect(context).toHaveTextContent('Canonical stateUNKNOWN')
  })

  it('routes without adding operational write controls', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('link', { name: 'Work Orders' }))
    expect(await screen.findByRole('heading', { name: 'Work Orders' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/Domain data is intentionally not implemented/i)).toBeInTheDocument()
  })
})
