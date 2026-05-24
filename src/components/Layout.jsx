import { NavLink, Outlet } from 'react-router-dom'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

const links = [
  { to: '/', label: 'Recording' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/routes', label: 'Routes' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { canInstall, triggerInstall } = useInstallPrompt()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold">Traffic Monitor PWA</h1>
          <nav className="flex gap-2">
            {canInstall ? (
              <button
                type="button"
                onClick={triggerInstall}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950"
              >
                Install
              </button>
            ) : null}
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
