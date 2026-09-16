import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AppShell, RoutePlaceholder } from './app-shell'
import { MissionControl } from './mission-control'
import { OperationsDataProvider } from './operations-data'

export const routes = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <MissionControl />,
      },
      {
        path: 'work-orders',
        element: (
          <RoutePlaceholder
            title="Work Orders"
            description="The shell route is reserved for the Phase 4.6 read-only Work Orders views."
          />
        ),
      },
      {
        path: 'evidence-audit',
        element: (
          <RoutePlaceholder
            title="Evidence & Audit"
            description="The shell route is reserved for the Phase 4.7 read-only evidence and audit surfaces."
          />
        ),
      },
      {
        path: 'system-swarm',
        element: (
          <RoutePlaceholder
            title="System / Swarm"
            description="The shell route is reserved for the Phase 4.8 read-only system and swarm surfaces."
          />
        ),
      },
    ],
  },
]

const router = createBrowserRouter(routes)

export function App() {
  return (
    <OperationsDataProvider>
      <RouterProvider router={router} />
    </OperationsDataProvider>
  )
}
