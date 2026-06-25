import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components'
import { startOutboxAutoReplay } from './db/offlineQueue'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import RoutesPage from './pages/RoutesPage'
import SessionDetailPage from './pages/SessionDetailPage'
import SessionsPage from './pages/SessionsPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  const { user, loading } = useAuth()

  useEffect(() => {
    startOutboxAutoReplay()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={null} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
