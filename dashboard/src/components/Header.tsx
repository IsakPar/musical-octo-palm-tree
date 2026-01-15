import { useLocation } from 'react-router-dom'
import { useBotStore } from '../stores/useBotStore'
import { useAuthStore } from '../stores/useAuthStore'
import LiveIndicator from './LiveIndicator'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/gabagool': 'Gabagool Bot',
  '/clipper': 'Clipper Bot',
  '/sniper': 'Sniper Bot',
  '/scanner': 'Market Scanner',
  '/decisions': 'Decision Log',
  '/logs': 'Activity Log',
}

export default function Header() {
  const { connected, darkMode, toggleTheme } = useBotStore()
  const { email, logout } = useAuthStore()
  const location = useLocation()

  const pageTitle = pageTitles[location.pathname] || 'Dashboard'

  return (
    <header className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} border-b px-4 py-3`}>
      <div className="max-w-[1920px] mx-auto flex items-center justify-between">
        {/* Page Title */}
        <div className="flex items-center gap-3 pl-12 lg:pl-0">
          <h1 className={`text-lg font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
            {pageTitle}
          </h1>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <LiveIndicator
            status={connected ? 'connected' : 'disconnected'}
            label="Live"
          />

          {/* Divider */}
          <div className={`w-px h-6 hidden sm:block ${darkMode ? 'bg-tv-border' : 'bg-tv-light-border'}`} />

          {/* User Info */}
          <div className="flex items-center gap-3">
            <span className={`text-sm hidden md:inline ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              {email}
            </span>
            <button
              onClick={logout}
              className={`p-2 rounded-lg transition-colors ${darkMode
                ? 'hover:bg-tv-bg-hover text-tv-text-secondary hover:text-tv-red'
                : 'hover:bg-tv-light-bg-tertiary text-tv-light-text-secondary hover:text-tv-red'
                }`}
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${darkMode
              ? 'hover:bg-tv-bg-hover text-tv-text-secondary'
              : 'hover:bg-tv-light-bg-tertiary text-tv-light-text-secondary'
              }`}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
