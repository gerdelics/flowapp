import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import RecordingPage from '../../pages/RecordingPage'

const links = [
  { to: '/', label: 'Recording' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/routes', label: 'Routes' },
  { to: '/settings', label: 'Settings' },
]

function NavItems({ onNavigate, className = 'gap-2 md:flex' }) {
  return (
    <nav className={className}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-md px-3 py-1.5 text-sm transition ${
              isActive
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

function SyncIndicator({ online, firebaseConnected, pendingWrites }) {
  const offline = !online || !firebaseConnected
  const label = offline
    ? pendingWrites > 0
      ? `Offline · ${pendingWrites} pending`
      : 'Offline'
    : pendingWrites > 0
      ? `Syncing · ${pendingWrites}`
      : 'Synced'
  const tone = offline
    ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
    : pendingWrites > 0
      ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300'
      : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium sm:inline-flex ${tone}`}
      title={offline ? 'Changes are saved locally and will sync when back online.' : 'All changes synced.'}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          offline ? 'bg-amber-400' : pendingWrites > 0 ? 'bg-cyan-400' : 'bg-emerald-400'
        }`}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isDark, toggleTheme } = useTheme()
  const { logout } = useAuth()
  const { online, firebaseConnected, pendingWrites } = useConnectionStatus()
  const location = useLocation()
  const isRecordingRoute = location.pathname === '/'

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">Traffic Monitor PWA</h1>
            <p className="text-[10px] font-mono text-slate-500 leading-none mt-0.5">
              {__GIT_COMMIT__} · {new Date(__BUILD_TIME__).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SyncIndicator
              online={online}
              firebaseConnected={firebaseConnected}
              pendingWrites={pendingWrites}
            />

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 hover:border-cyan-500"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {isDark ? '☀️' : '🌙'}
              </span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:border-red-500"
              title="Sign out"
            >
              Sign out
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              <span className="flex flex-col gap-1">
                <span className="block h-0.5 w-5 rounded bg-current" />
                <span className="block h-0.5 w-5 rounded bg-current" />
                <span className="block h-0.5 w-5 rounded bg-current" />
              </span>
            </button>
          </div>

          <NavItems className="hidden gap-2 md:flex" onNavigate={closeMobileMenu} />
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-800 bg-slate-900 px-4 py-3 md:hidden">
            <NavItems className="mx-auto flex w-full max-w-6xl flex-col gap-2" onNavigate={closeMobileMenu} />
          </div>
        ) : null}
      </header>

      <main
        className={`mx-auto w-full max-w-6xl flex-1 px-4 ${
          isRecordingRoute ? 'py-2' : 'py-6'
        }`}
      >
        <div className={isRecordingRoute ? '' : 'hidden'}>
          <RecordingPage isActive={isRecordingRoute} />
        </div>

        {isRecordingRoute ? null : <Outlet />}
      </main>
    </div>
  )
}
