import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBotStore } from '../stores/useBotStore'
import MetricCard from '../components/MetricCard'
import DepthChart from '../components/DepthChart'
import PortfolioChart from '../components/PortfolioChart'
import { Activity, Target, TrendingUp, DollarSign, Clock, Zap } from 'lucide-react'

interface StrategyStats {
  todayPnl: number
  totalPnl: number
  trades: number
  winRate: number
  avgEdge: number
  hitRate: number
}

interface ArbOpportunity {
  timestamp: string
  yesPrice: number
  noPrice: number
  sum: number
  edge: number
  taken: boolean
}

interface DepthLevel {
  price: number
  size: number
}

export default function StrategyDetailPage() {
  const { strategy } = useParams<{ strategy: string }>()
  const { darkMode } = useBotStore()
  const [stats, setStats] = useState<StrategyStats | null>(null)
  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([])
  const [yesBids, setYesBids] = useState<DepthLevel[]>([])
  const [yesAsks, setYesAsks] = useState<DepthLevel[]>([])
  const [noBids, setNoBids] = useState<DepthLevel[]>([])
  const [noAsks, setNoAsks] = useState<DepthLevel[]>([])
  const [loading, setLoading] = useState(true)

  const strategyName = strategy?.toUpperCase() || 'STRATEGY'
  const strategyDescription = getStrategyDescription(strategy || '')

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch strategy stats
        const statsRes = await fetch(`/api/strategy/${strategy}/stats`)
        if (statsRes.ok) {
          setStats(await statsRes.json())
        }

        // Fetch recent opportunities
        const oppsRes = await fetch(`/api/strategy/${strategy}/opportunities`)
        if (oppsRes.ok) {
          setOpportunities(await oppsRes.json())
        }

        // Fetch depth data
        const depthRes = await fetch(`/api/strategy/${strategy}/depth`)
        if (depthRes.ok) {
          const depth = await depthRes.json()
          setYesBids(depth.yes?.bids || [])
          setYesAsks(depth.yes?.asks || [])
          setNoBids(depth.no?.bids || [])
          setNoAsks(depth.no?.asks || [])
        }
      } catch (err) {
        console.error('Failed to fetch strategy data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [strategy])

  function getStrategyDescription(name: string): string {
    switch (name.toLowerCase()) {
      case 'sumto100':
        return 'Depth-aware VWAP arbitrage: Buy YES + NO when sum < $1.00'
      case 'clipper':
        return 'Top-of-book arbitrage using best bid/ask prices'
      case 'sniper':
        return 'Sports time arbitrage using ESPN data'
      default:
        return 'Trading strategy'
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Mock data for demo
  const mockStats: StrategyStats = {
    todayPnl: 85.30,
    totalPnl: 2450.32,
    trades: 23,
    winRate: 78,
    avgEdge: 0.8,
    hitRate: 72,
  }

  const mockOpportunities: ArbOpportunity[] = [
    { timestamp: new Date().toISOString(), yesPrice: 0.45, noPrice: 0.52, sum: 0.97, edge: 3, taken: true },
    { timestamp: new Date(Date.now() - 7000).toISOString(), yesPrice: 0.46, noPrice: 0.53, sum: 0.99, edge: 1, taken: false },
    { timestamp: new Date(Date.now() - 15000).toISOString(), yesPrice: 0.44, noPrice: 0.52, sum: 0.96, edge: 4, taken: true },
    { timestamp: new Date(Date.now() - 23000).toISOString(), yesPrice: 0.47, noPrice: 0.51, sum: 0.98, edge: 2, taken: true },
    { timestamp: new Date(Date.now() - 35000).toISOString(), yesPrice: 0.48, noPrice: 0.53, sum: 1.01, edge: -1, taken: false },
  ]

  const mockYesBids: DepthLevel[] = [
    { price: 0.45, size: 150 },
    { price: 0.44, size: 200 },
    { price: 0.43, size: 350 },
    { price: 0.42, size: 500 },
    { price: 0.41, size: 800 },
  ]

  const mockYesAsks: DepthLevel[] = [
    { price: 0.46, size: 120 },
    { price: 0.47, size: 180 },
    { price: 0.48, size: 250 },
    { price: 0.49, size: 400 },
    { price: 0.50, size: 600 },
  ]

  const mockNoBids: DepthLevel[] = [
    { price: 0.52, size: 180 },
    { price: 0.51, size: 220 },
    { price: 0.50, size: 300 },
    { price: 0.49, size: 450 },
    { price: 0.48, size: 700 },
  ]

  const mockNoAsks: DepthLevel[] = [
    { price: 0.53, size: 100 },
    { price: 0.54, size: 160 },
    { price: 0.55, size: 240 },
    { price: 0.56, size: 380 },
    { price: 0.57, size: 550 },
  ]

  const displayStats = stats || mockStats
  const displayOpportunities = opportunities.length > 0 ? opportunities : mockOpportunities
  const displayYesBids = yesBids.length > 0 ? yesBids : mockYesBids
  const displayYesAsks = yesAsks.length > 0 ? yesAsks : mockYesAsks
  const displayNoBids = noBids.length > 0 ? noBids : mockNoBids
  const displayNoAsks = noAsks.length > 0 ? noAsks : mockNoAsks

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`${
          darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'
        } rounded-lg border p-4`}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {/* Active indicator */}
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-tv-green" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-tv-green animate-ping opacity-75" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                {strategyName} Strategy
              </h1>
              <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                {strategyDescription}
              </p>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium bg-tv-green/20 text-tv-green`}
          >
            Active
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Today P&L"
          value={displayStats.todayPnl.toFixed(2)}
          prefix="$"
          variant={displayStats.todayPnl >= 0 ? 'profit' : 'loss'}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MetricCard
          title="Total P&L"
          value={displayStats.totalPnl.toFixed(2)}
          prefix="$"
          variant={displayStats.totalPnl >= 0 ? 'profit' : 'loss'}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          title="Trades"
          value={displayStats.trades}
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          title="Win Rate"
          value={displayStats.winRate}
          suffix="%"
          variant={displayStats.winRate >= 50 ? 'profit' : 'loss'}
          icon={<Target className="w-4 h-4" />}
        />
        <MetricCard
          title="Avg Edge"
          value={displayStats.avgEdge}
          suffix="%"
          icon={<Zap className="w-4 h-4" />}
        />
        <MetricCard
          title="Hit Rate"
          value={displayStats.hitRate}
          suffix="%"
          icon={<Clock className="w-4 h-4" />}
        />
      </div>

      {/* Depth Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepthChart
          bids={displayYesBids}
          asks={displayYesAsks}
          midPrice={0.455}
          tokenLabel="YES"
          height={220}
        />
        <DepthChart
          bids={displayNoBids}
          asks={displayNoAsks}
          midPrice={0.525}
          tokenLabel="NO"
          height={220}
        />
      </div>

      {/* Recent Opportunities */}
      <div
        className={`${
          darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'
        } rounded-lg border overflow-hidden`}
      >
        <div
          className={`px-4 py-3 border-b ${
            darkMode ? 'border-tv-border' : 'border-tv-light-border'
          }`}
        >
          <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
            Recent Arbitrage Opportunities
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}>
                <th className={`text-left px-4 py-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                  Time
                </th>
                <th className={`text-right px-4 py-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                  YES
                </th>
                <th className={`text-right px-4 py-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                  NO
                </th>
                <th className={`text-right px-4 py-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                  Sum
                </th>
                <th className={`text-right px-4 py-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                  Edge
                </th>
                <th className={`text-center px-4 py-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {displayOpportunities.map((opp, idx) => (
                <tr
                  key={idx}
                  className={`border-t ${darkMode ? 'border-tv-border hover:bg-tv-bg-tertiary' : 'border-tv-light-border hover:bg-tv-light-bg-tertiary'}`}
                >
                  <td className={`px-4 py-2 tabular-nums ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                    {formatTime(opp.timestamp)}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                    ${opp.yesPrice.toFixed(2)}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                    ${opp.noPrice.toFixed(2)}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums font-medium ${opp.sum < 1 ? 'text-tv-green' : 'text-tv-red'}`}>
                    ${opp.sum.toFixed(2)}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${opp.edge > 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                    {opp.edge > 0 ? '+' : ''}{opp.edge}%
                  </td>
                  <td className="px-4 py-2 text-center">
                    {opp.taken ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-tv-green/20 text-tv-green">
                        <span className="w-1.5 h-1.5 rounded-full bg-tv-green" />
                        Taken
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-tv-bg-tertiary text-tv-text-tertiary' : 'bg-tv-light-bg-tertiary text-tv-light-text-secondary'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${darkMode ? 'bg-tv-text-tertiary' : 'bg-tv-light-text-secondary'}`} />
                        Skipped
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
