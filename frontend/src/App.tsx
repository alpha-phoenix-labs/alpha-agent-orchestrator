import type { PropsWithChildren } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AppShell, ShellErrorBoundary } from './app-shell'
import { EvidenceAudit } from './evidence-audit'
import { I18nProvider, useI18n } from './i18n'
import { MissionControl } from './mission-control'
import { OperationsDataProvider } from './operations-data'
import { SystemSwarm } from './system-swarm'
import { TraceWaterfall } from './trace-waterfall'
import { WorkOrders } from './work-orders'

function IsolatedSurface({ children }: PropsWithChildren) {
  const { t } = useI18n()
  return (
    <ShellErrorBoundary
      errorTitle={t('app.viewUnavailable')}
      errorDetail={t('app.viewUnavailableDetail')}
    >
      {children}
    </ShellErrorBoundary>
  )
}

export const routes = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <IsolatedSurface>
            <MissionControl />
          </IsolatedSurface>
        ),
      },
      {
        path: 'work-orders',
        element: (
          <IsolatedSurface>
            <WorkOrders />
          </IsolatedSurface>
        ),
      },
      {
        path: 'evidence-audit',
        element: (
          <div className="space-y-6">
            <IsolatedSurface>
              <EvidenceAudit />
            </IsolatedSurface>
            <IsolatedSurface>
              <TraceWaterfall />
            </IsolatedSurface>
          </div>
        ),
      },
      {
        path: 'system-swarm',
        element: (
          <IsolatedSurface>
            <SystemSwarm />
          </IsolatedSurface>
        ),
      },
    ],
  },
]

const router = createBrowserRouter(routes)

export function App() {
  return (
    <I18nProvider>
      <OperationsDataProvider>
        <RouterProvider router={router} />
      </OperationsDataProvider>
    </I18nProvider>
  )
}
