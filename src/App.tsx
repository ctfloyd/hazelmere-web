import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { GainsTracker } from '@/pages/GainsTracker'
import { Test } from './Test'

function App() {
  useEffect(() => {
    // Set dark mode by default
    document.documentElement.classList.add('dark')
    // Log to console to verify the effect is running
    console.log('Dark mode applied, Tailwind CSS should be active')
  }, [])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<GainsTracker />} />
        <Route path="/gains" element={<Navigate to="/" replace />} />
        <Route path="/test" element={<Test />} />
        {/* Redirect all other routes to main page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App