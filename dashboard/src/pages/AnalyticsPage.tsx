import { useState, useEffect } from 'react'
import { useBotStore } from '../stores/useBotStore'

interface WinRateStats {
    total_trades: number
    wins: number
    losses: number
    win_rate: number
    total_pnl: number
    avg_pnl: number
    best_trade: number
    worst_trade: number
    profit_factor: number
}

interface Trade {
    timestamp: string
    bot: string
    market_slug: string
    asset?: string
    outcome?: string
    action: string
    price: number
    pnl: number
    reason?: string
}

interface PortfolioPoint {
    timestamp: string
    bot: string
    total_value: number
    realized_pnl: number
}

export default function AnalyticsPage() {
    const { darkMode } = useBotStore()
    const [loading, setLoading] = useState(true)
    const [winRates, setWinRates] = useState<Record<string, WinRateStats>>({})
    const [topTrades, setTopTrades] = useState<{ best: Trade[], worst: Trade[] }>({ best: [], worst: [] })
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioPoint[]>([])
    const [decisionBreakdown, setDecisionBreakdown] = useState<Record<string, { taken: Record<string, number>, skipped: Record<string, number> }>>({})
    const [hours, setHours] = useState(24)

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const [winRateRes, topTradesRes, portfolioRes, decisionRes] = await Promise.all([
                    fetch('/api/analytics/win-rate'),
                    fetch('/api/analytics/top-trades?limit=5'),
                    fetch(`/api/analytics/portfolio-history?hours=${hours}`),
                    fetch('/api/analytics/decision-breakdown'),
                ])

                if (winRateRes.ok) setWinRates(await winRateRes.json())
                if (topTradesRes.ok) setTopTrades(await topTradesRes.json())
                if (portfolioRes.ok) {
                    const data = await portfolioRes.json()
                    setPortfolioHistory(data.data || [])
                }
                if (decisionRes.ok) setDecisionBreakdown(await decisionRes.json())
            } catch (err) {
                console.error('Failed to fetch analytics:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchAnalytics()
        const interval = setInterval(fetchAnalytics, 30000)
        return () => clearInterval(interval)
    }, [hours])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(value)
    }

    const formatPnl = (value: number) => {
        const prefix = value >= 0 ? '+' : ''
        return prefix + formatCurrency(value)
    }

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const getBotColor = (bot: string) => {
        switch (bot) {
            case 'gabagool': return 'text-tv-red'
            case 'clipper': return 'text-tv-green'
            case 'sniper': return 'text-tv-blue'
            default: return darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'
        }
    }

    const getBotBgColor = (bot: string) => {
        switch (bot) {
            case 'gabagool': return 'bg-tv-red/20'
            case 'clipper': return 'bg-tv-green/20'
            case 'sniper': return 'bg-tv-blue/20'
            default: return darkMode ? 'bg-tv-bg-tertiary' : 'bg-gray-100'
        }
    }

    // Calculate combined stats
    const combinedStats = Object.values(winRates).reduce((acc, stats) => ({
        total_trades: acc.total_trades + stats.total_trades,
        wins: acc.wins + stats.wins,
        losses: acc.losses + stats.losses,
        total_pnl: acc.total_pnl + stats.total_pnl,
    }), { total_trades: 0, wins: 0, losses: 0, total_pnl: 0 })

    const overallWinRate = combinedStats.total_trades > 0
        ? (combinedStats.wins / combinedStats.total_trades * 100).toFixed(1)
        : '0'

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Analytics Dashboard
                        </h1>
                        <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            Performance metrics and historical analysis (from database)
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {[24, 48, 72, 168].map(h => (
                            <button
                                key={h}
                                onClick={() => setHours(h)}
                                className={`px-3 py-1 rounded text-sm ${hours === h
                                    ? 'bg-tv-blue text-white'
                                    : darkMode
                                        ? 'bg-tv-bg-tertiary text-tv-text-secondary hover:bg-tv-bg-hover'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {h}h
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className={`p-8 text-center ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                    Loading analytics...
                </div>
            ) : (
                <>
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                            <div className={`text-xs uppercase ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Total Trades
                            </div>
                            <div className={`text-2xl font-bold mt-1 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                {combinedStats.total_trades}
                            </div>
                        </div>
                        <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                            <div className={`text-xs uppercase ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Win Rate
                            </div>
                            <div className={`text-2xl font-bold mt-1 ${parseFloat(overallWinRate) >= 50 ? 'text-tv-green' : 'text-tv-red'}`}>
                                {overallWinRate}%
                            </div>
                        </div>
                        <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                            <div className={`text-xs uppercase ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                W / L
                            </div>
                            <div className={`text-2xl font-bold mt-1 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                <span className="text-tv-green">{combinedStats.wins}</span>
                                <span className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}> / </span>
                                <span className="text-tv-red">{combinedStats.losses}</span>
                            </div>
                        </div>
                        <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                            <div className={`text-xs uppercase ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Total P&L
                            </div>
                            <div className={`text-2xl font-bold mt-1 ${combinedStats.total_pnl >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                {formatPnl(combinedStats.total_pnl)}
                            </div>
                        </div>
                    </div>

                    {/* Win Rate by Bot */}
                    <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Performance by Bot
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries(winRates).map(([bot, stats]) => (
                                <div
                                    key={bot}
                                    className={`p-4 rounded-lg ${getBotBgColor(bot)}`}
                                >
                                    <div className={`font-semibold capitalize mb-3 ${getBotColor(bot)}`}>
                                        {bot}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <div className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-500'}>Win Rate</div>
                                            <div className={`font-semibold ${stats.win_rate >= 50 ? 'text-tv-green' : 'text-tv-red'}`}>
                                                {stats.win_rate}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-500'}>Trades</div>
                                            <div className={darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}>
                                                {stats.total_trades}
                                            </div>
                                        </div>
                                        <div>
                                            <div className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-500'}>Avg P&L</div>
                                            <div className={stats.avg_pnl >= 0 ? 'text-tv-green' : 'text-tv-red'}>
                                                {formatPnl(stats.avg_pnl)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-500'}>Profit Factor</div>
                                            <div className={stats.profit_factor >= 1 ? 'text-tv-green' : 'text-tv-red'}>
                                                {stats.profit_factor.toFixed(2)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-500'}>Best Trade</div>
                                            <div className="text-tv-green">{formatPnl(stats.best_trade)}</div>
                                        </div>
                                        <div>
                                            <div className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-500'}>Worst Trade</div>
                                            <div className="text-tv-red">{formatPnl(stats.worst_trade)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {Object.keys(winRates).length === 0 && (
                                <div className={`col-span-3 text-center py-8 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                    No trade data yet. Start trading to see analytics.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Trades */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Best Trades */}
                        <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                <span className="text-tv-green">Best Trades</span>
                            </h2>
                            <div className="space-y-2">
                                {topTrades.best.length === 0 ? (
                                    <div className={`text-center py-4 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                        No trades yet
                                    </div>
                                ) : topTrades.best.map((trade, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-gray-50'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className={`text-xs px-2 py-0.5 rounded ${getBotBgColor(trade.bot)} ${getBotColor(trade.bot)}`}>
                                                    {trade.bot}
                                                </span>
                                                <div className={`mt-1 text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    {trade.asset || trade.market_slug?.slice(0, 30)}
                                                </div>
                                                <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                                    {formatTime(trade.timestamp)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-semibold text-tv-green">
                                                    {formatPnl(trade.pnl)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Worst Trades */}
                        <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                            <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                <span className="text-tv-red">Worst Trades</span>
                            </h2>
                            <div className="space-y-2">
                                {topTrades.worst.length === 0 ? (
                                    <div className={`text-center py-4 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                        No trades yet
                                    </div>
                                ) : topTrades.worst.map((trade, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-gray-50'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className={`text-xs px-2 py-0.5 rounded ${getBotBgColor(trade.bot)} ${getBotColor(trade.bot)}`}>
                                                    {trade.bot}
                                                </span>
                                                <div className={`mt-1 text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    {trade.asset || trade.market_slug?.slice(0, 30)}
                                                </div>
                                                <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                                    {formatTime(trade.timestamp)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-semibold text-tv-red">
                                                    {formatPnl(trade.pnl)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Decision Breakdown */}
                    <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Decision Breakdown
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries(decisionBreakdown).map(([bot, data]) => {
                                const takenTotal = Object.values(data.taken).reduce((a, b) => a + b, 0)
                                const skippedTotal = Object.values(data.skipped).reduce((a, b) => a + b, 0)
                                const total = takenTotal + skippedTotal
                                const takenPct = total > 0 ? (takenTotal / total * 100).toFixed(1) : 0

                                return (
                                    <div key={bot} className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-gray-50'}`}>
                                        <div className={`font-semibold capitalize mb-2 ${getBotColor(bot)}`}>
                                            {bot}
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="flex-1 h-4 bg-gray-700 rounded overflow-hidden">
                                                <div
                                                    className="h-full bg-tv-green"
                                                    style={{ width: `${takenPct}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-gray-500'}`}>
                                                {takenPct}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-tv-green">Taken: {takenTotal}</span>
                                            <span className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}>Skipped: {skippedTotal}</span>
                                        </div>
                                        {Object.entries(data.skipped).length > 0 && (
                                            <div className={`mt-2 pt-2 border-t ${darkMode ? 'border-tv-border' : 'border-gray-200'}`}>
                                                <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'} mb-1`}>
                                                    Skip reasons:
                                                </div>
                                                {Object.entries(data.skipped).slice(0, 3).map(([reason, count]) => (
                                                    <div key={reason} className="flex justify-between text-xs">
                                                        <span className={darkMode ? 'text-tv-text-secondary' : 'text-gray-500'}>
                                                            {reason.slice(0, 20)}
                                                        </span>
                                                        <span className={darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}>
                                                            {count}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {Object.keys(decisionBreakdown).length === 0 && (
                                <div className={`col-span-3 text-center py-8 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                    No decision data yet.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Portfolio History Mini Chart */}
                    <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Portfolio History (Last {hours}h)
                        </h2>
                        {portfolioHistory.length === 0 ? (
                            <div className={`text-center py-8 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                No portfolio snapshots yet. Data will appear after bots run for a while.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className={darkMode ? 'text-tv-text-secondary' : 'text-gray-500'}>
                                            <th className="text-left py-2">Time</th>
                                            <th className="text-left py-2">Bot</th>
                                            <th className="text-right py-2">Total Value</th>
                                            <th className="text-right py-2">Realized P&L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {portfolioHistory.slice(-20).map((point, idx) => (
                                            <tr key={idx} className={`border-t ${darkMode ? 'border-tv-border' : 'border-gray-200'}`}>
                                                <td className={`py-2 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                                    {formatTime(point.timestamp)}
                                                </td>
                                                <td className={`py-2 ${getBotColor(point.bot)}`}>
                                                    {point.bot}
                                                </td>
                                                <td className={`py-2 text-right ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    {formatCurrency(point.total_value)}
                                                </td>
                                                <td className={`py-2 text-right ${point.realized_pnl >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                                    {formatPnl(point.realized_pnl)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
