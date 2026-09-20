import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/app.scss'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initLocale } from './i18n/index.ts'

// Applies `<html lang>` before anything renders, so the document is never briefly in the wrong
// language for the browser's own features (hyphenation, quotes, screen readers).
initLocale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
