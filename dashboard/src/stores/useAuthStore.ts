import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  // State
  token: string | null
  email: string | null
  isAuthenticated: boolean

  // Auth flow state
  authStep: 'email' | 'otp' | 'authenticated'
  pendingEmail: string | null

  // Actions
  setToken: (token: string, email: string) => void
  logout: () => void
  setPendingEmail: (email: string) => void
  setAuthStep: (step: 'email' | 'otp' | 'authenticated') => void
  reset: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      isAuthenticated: false,
      authStep: 'email',
      pendingEmail: null,

      setToken: (token, email) => set({
        token,
        email,
        isAuthenticated: true,
        authStep: 'authenticated',
        pendingEmail: null,
      }),

      logout: () => set({
        token: null,
        email: null,
        isAuthenticated: false,
        authStep: 'email',
        pendingEmail: null,
      }),

      setPendingEmail: (email) => set({
        pendingEmail: email,
        authStep: 'otp',
      }),

      setAuthStep: (step) => set({ authStep: step }),

      reset: () => set({
        authStep: 'email',
        pendingEmail: null,
      }),
    }),
    {
      name: 'poly-auth',
      partialize: (state) => ({
        token: state.token,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
