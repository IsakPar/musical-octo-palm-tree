import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useWebSocket } from './hooks/useWebSocket'
import { useBotStore } from './stores/useBotStore'
import { useAuthStore } from './stores/useAuthStore'

// Components
import AuthPage from './components/AuthPage'
import Header from './components/Header'
import Sidebar from './components/Sidebar'

// Pages
import DashboardPage from './pages/DashboardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import GabagoolPage from './pages/GabagoolPage'
import ClipperPage from './pages/ClipperPage'
import SniperPage from './pages/SniperPage'
import SynthArbPage from './pages/SynthArbPage'
import MarketScannerPage from './pages/MarketScannerPage'
import DecisionLogPage from './pages/DecisionLogPage'
import ActivityLogPage from './pages/ActivityLogPage'
import StrategyDetailPage from './pages/StrategyDetailPage'

function AppLayout() {
  // Initialize WebSocket connection (only when authenticated)
  useWebSocket()

  const { darkMode } = useBotStore()

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-tv-bg-primary' : 'bg-tv-light-bg-primary'}`}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area with left padding for sidebar */}
      <div className="lg:pl-64">
        <Header />
        <main className="p-4 max-w-[1920px] mx-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/gabagool" element={<GabagoolPage />} />
            <Route path="/clipper" element={<ClipperPage />} />
            <Route path="/sniper" element={<SniperPage />} />
            <Route path="/synth-arb" element={<SynthArbPage />} />
            <Route path="/scanner" element={<MarketScannerPage />} />
            <Route path="/decisions" element={<DecisionLogPage />} />
            <Route path="/logs" element={<ActivityLogPage />} />
            <Route path="/strategy/:strategy" element={<StrategyDetailPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  const { darkMode } = useBotStore()
  const { isAuthenticated } = useAuthStore()

  // Set initial theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
  }, [darkMode])

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage />
  }

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
