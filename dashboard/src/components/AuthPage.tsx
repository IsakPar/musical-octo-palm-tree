import { useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useBotStore } from '../stores/useBotStore'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function AuthPage() {
  const { authStep, pendingEmail, setPendingEmail, setToken, reset } = useAuthStore()
  const { darkMode, toggleTheme } = useBotStore()

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send OTP')
      }

      setPendingEmail(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, otp }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Invalid OTP')
      }

      setToken(data.token, pendingEmail!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    reset()
    setEmail('')
    setOtp('')
    setError('')
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-tv-bg-primary' : 'bg-tv-light-bg-primary'}`}>
      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            darkMode
              ? 'hover:bg-tv-bg-hover text-tv-text-secondary'
              : 'hover:bg-tv-light-bg-tertiary text-tv-light-text-secondary'
          }`}
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

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-tv-blue to-tv-purple mb-4">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
            </div>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
              Poly Trading Bots
            </h1>
            <p className={`mt-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              {authStep === 'email' ? 'Sign in to access your dashboard' : 'Enter the code sent to your email'}
            </p>
          </div>

          {/* Auth Card */}
          <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-xl border p-6`}>
            {authStep === 'email' ? (
              <form onSubmit={handleEmailSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                      className={`w-full px-4 py-3 rounded-lg border transition-colors outline-none ${
                        darkMode
                          ? 'bg-tv-bg-tertiary border-tv-border text-tv-text-primary placeholder-tv-text-tertiary focus:border-tv-blue'
                          : 'bg-tv-light-bg-tertiary border-tv-light-border text-tv-light-text-primary placeholder-tv-light-text-secondary focus:border-tv-blue'
                      }`}
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-tv-red/10 border border-tv-red/20">
                      <p className="text-sm text-tv-red">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                      loading || !email
                        ? 'bg-tv-blue/50 cursor-not-allowed'
                        : 'bg-tv-blue hover:bg-tv-blue-hover'
                    } text-white`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Continue'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit}>
                <div className="space-y-4">
                  {/* Email display */}
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                    <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                      Sending code to
                    </p>
                    <p className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                      {pendingEmail}
                    </p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                      Verification code
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      required
                      autoFocus
                      maxLength={6}
                      className={`w-full px-4 py-3 rounded-lg border transition-colors outline-none text-center text-2xl tracking-[0.5em] font-mono ${
                        darkMode
                          ? 'bg-tv-bg-tertiary border-tv-border text-tv-text-primary placeholder-tv-text-tertiary focus:border-tv-blue'
                          : 'bg-tv-light-bg-tertiary border-tv-light-border text-tv-light-text-primary placeholder-tv-light-text-secondary focus:border-tv-blue'
                      }`}
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-tv-red/10 border border-tv-red/20">
                      <p className="text-sm text-tv-red">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                      loading || otp.length !== 6
                        ? 'bg-tv-blue/50 cursor-not-allowed'
                        : 'bg-tv-blue hover:bg-tv-blue-hover'
                    } text-white`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBack}
                    className={`w-full py-2 text-sm transition-colors ${
                      darkMode ? 'text-tv-text-secondary hover:text-tv-text-primary' : 'text-tv-light-text-secondary hover:text-tv-light-text-primary'
                    }`}
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <p className={`text-center mt-6 text-sm ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
            Access restricted to authorized users only
          </p>
        </div>
      </div>
    </div>
  )
}
