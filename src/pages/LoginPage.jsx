import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!email.trim() || !password) {
      return
    }

    setSubmitting(true)
    setError('')
    const message = await login(email, password)
    if (message) {
      setError(message)
    }
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <h1 className="text-lg font-semibold">Traffic Monitor PWA</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to continue.</p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <label className="block text-sm text-slate-300">
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
              required
            />
          </label>

          <label className="block text-sm text-slate-300">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
              required
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password}
            className="mt-1 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
