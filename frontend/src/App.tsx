import type { PropsWithChildren } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AppShell, ShellErrorBoundary } from './app-shell'
import { EvidenceAudit } from './evidence-audit'
import { I18nProvider, useI18n } from './i18n'
import { MissionControl } from './mission-control'
import { OperationsDataProvider } from './operations-data'
import { OperationsLiveProvider } from './operations-live-provider'
import { SystemSwarm } from './system-swarm'
import { TraceWaterfall } from './trace-waterfall'
import { premiumVisualQaSnapshot } from './visual-qa-fixture'
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

function visualQaFixtureEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_VISUAL_QA_FIXTURES !== 'true') return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('visualQa') === 'premium'
}

export function App() {
  const visualQa = visualQaFixtureEnabled()

  return (
    <I18nProvider>
      {visualQa ? (
        <OperationsDataProvider snapshot={premiumVisualQaSnapshot}>
          <div className="visual-qa-fixture-banner" role="status">
            VISUAL QA FIXTURE · NOT LIVE AUTHORITY
          </div>
          <RouterProvider router={router} />
        </OperationsDataProvider>
      ) : (
        <OperationsLiveProvider>
          <RouterProvider router={router} />
        </OperationsLiveProvider>
      )}
    </I18nProvider>
  )
}
