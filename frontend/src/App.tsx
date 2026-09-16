import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AppShell } from './app-shell'
import { EvidenceAudit } from './evidence-audit'
import { MissionControl } from './mission-control'
import { OperationsDataProvider } from './operations-data'
import { SystemSwarm } from './system-swarm'
import { TraceWaterfall } from './trace-waterfall'
import { WorkOrders } from './work-orders'

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
        element: <WorkOrders />,
      },
      {
        path: 'evidence-audit',
        element: (
          <div className="space-y-6">
            <EvidenceAudit />
            <TraceWaterfall />
          </div>
        ),
      },
      {
        path: 'system-swarm',
        element: <SystemSwarm />,
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
