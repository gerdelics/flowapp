import { useEffect, useMemo, useState } from 'react'

const THEME_STORAGE_KEY = 'flowapp-theme'

function resolveInitialTheme() {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme)

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'dark')
    document.documentElement.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light')

    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    }

    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const isDark = theme === 'dark'

  const actions = useMemo(
    () => ({
      setTheme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
    }),
    [],
  )

  return {
    theme,
    isDark,
    ...actions,
  }
}
