import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import './index.css'
import './premium-mission.css'
import './alpha-premium.css'
import './swarm-scene.css'
import './mission-control-layout.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('ROOT_ELEMENT_MISSING')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
