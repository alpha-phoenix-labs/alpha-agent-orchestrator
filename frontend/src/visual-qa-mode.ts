export function visualQaFixtureEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_VISUAL_QA_FIXTURES !== 'true') return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('visualQa') === 'premium'
}
