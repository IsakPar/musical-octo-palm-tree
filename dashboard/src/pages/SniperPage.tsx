import { useState, useEffect } from 'react'
import { useBotStore } from '../stores/useBotStore'

interface SniperState {
    status: string
    cash: number
    total_exposure: number
    total_value: number
    realized_pnl: number
    active_snipes: number
    completed_snipes: number
    scan_count: number
    games_checked: number
    opportunities_found: number
    orders_placed: number
    active_positions: Array<{
        id: string
        market: string
        game: string
        winner: string
        bid_price: number
        filled: number
        expected_profit: number
        status: string
    }>
    recent_snipes: Array<{
        id: string
        market: string
        filled: number
        profit: number
        status: string
    }>
}

export default function SniperPage() {
    const { darkMode, sniperScanHistory } = useBotStore()
    const [sniperState, setSniperState] = useState<SniperState | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchState = async () => {
            try {
                const resp = await fetch('/api/sniper')
                if (resp.ok) {
                    const data = await resp.json()
                    setSniperState(data)
                }
            } catch (e) {
                console.error('Failed to fetch sniper state:', e)
            } finally {
                setLoading(false)
            }
        }

        fetchState()
        const interval = setInterval(fetchState, 5000) // Refresh every 5s
        return () => clearInterval(interval)
    }, [])

    const formatUSD = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

    const formatPnL = (value: number) =>
        (value >= 0 ? '+' : '') + formatUSD(value)

    if (loading) {
        return (
            <div className={`flex items-center justify-center h-64 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                Loading Sniper bot...
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                The Sniper
                            </h1>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                99¢ Garbage Collector - Sports Time Arbitrage
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${sniperState?.status === 'running' ? 'bg-tv-green pulse-dot' : 'bg-tv-text-tertiary'}`} />
                        <span className={`text-sm font-medium ${sniperState?.status === 'running' ? 'text-tv-green' : darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {sniperState?.status === 'running' ? 'Hunting' : 'Stopped'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Cash', value: formatUSD(sniperState?.cash || 0) },
                    { label: 'Total Exposure', value: formatUSD(sniperState?.total_exposure || 0) },
                    { label: 'Total Value', value: formatUSD(sniperState?.total_value || 1000) },
                    { label: 'Realized P&L', value: formatPnL(sniperState?.realized_pnl || 0), isPnl: true },
                ].map((stat, i) => (
                    <div key={i} className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {stat.label}
                        </div>
                        <div className={`text-xl font-bold mt-1 ${stat.isPnl ? ((sniperState?.realized_pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red') : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Strategy Description */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Strategy Overview
                    </h2>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">🎮</span>
                                <span className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>Monitor Sports</span>
                            </div>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Watch NBA & NFL games via ESPN API. Detect when games end.
                            </p>
                        </div>
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">💰</span>
                                <span className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>Place Limit Bids</span>
                            </div>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Bid 96¢ for winning outcomes. Impatient sellers dump into our orders.
                            </p>
                        </div>
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">🎯</span>
                                <span className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>Collect $1.00</span>
                            </div>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Wait for market resolution. Redeem shares at $1.00. ~4% profit.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Activity Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Scan Count', value: `#${sniperState?.scan_count || 0}`, color: '' },
                    { label: 'Games Checked', value: sniperState?.games_checked || 0, color: '' },
                    { label: 'Opportunities', value: sniperState?.opportunities_found || 0, color: 'text-tv-yellow' },
                    { label: 'Orders Placed', value: sniperState?.orders_placed || 0, color: 'text-tv-green' },
                ].map((stat, i) => (
                    <div key={i} className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} border`}>
                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {stat.label}
                        </div>
                        <div className={`text-2xl font-bold mt-1 ${stat.color || (darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary')}`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Live Scan Activity */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Live Scan Activity
                    </h2>
                    <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                        Last {sniperScanHistory.length} scans
                    </span>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                    {sniperScanHistory.length > 0 ? (
                        <div className="space-y-3">
                            {sniperScanHistory.slice(0, 10).map((scan, idx) => (
                                <div key={idx} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-sm font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            Scan #{scan.scan_number}
                                        </span>
                                        <span className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                            {scan.timestamp && new Date(scan.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>

                                    {/* Games Found */}
                                    {scan.games_found.length > 0 ? (
                                        <div className="mb-2">
                                            <span className="text-xs text-tv-green font-medium">
                                                {scan.games_found.length} finished game(s):
                                            </span>
                                            {scan.games_found.map((game, gIdx) => (
                                                <div key={gIdx} className={`text-xs ml-2 mt-1 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                                    🏀 {game.matchup} — <span className="text-tv-yellow">{game.winner}</span> wins by {game.margin}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                            No finished games found
                                        </div>
                                    )}

                                    {/* Markets Searched */}
                                    {scan.markets_searched > 0 && (
                                        <div className="flex gap-4 text-xs mt-2">
                                            <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                Searched: {scan.markets_searched} markets
                                            </span>
                                            <span className="text-tv-green">
                                                Taken: {scan.opportunities_taken}
                                            </span>
                                            <span className="text-tv-yellow">
                                                Skipped: {scan.opportunities_skipped}
                                            </span>
                                        </div>
                                    )}

                                    {/* Skip Reasons (collapsible) */}
                                    {scan.opportunities_evaluated.filter(e => e.decision === 'SKIPPED').length > 0 && (
                                        <details className="mt-2">
                                            <summary className={`text-xs cursor-pointer ${darkMode ? 'text-tv-text-tertiary hover:text-tv-text-secondary' : 'text-gray-400 hover:text-gray-600'}`}>
                                                View skip reasons ({scan.opportunities_evaluated.filter(e => e.decision === 'SKIPPED').length})
                                            </summary>
                                            <div className="mt-1 space-y-1 pl-2">
                                                {scan.opportunities_evaluated
                                                    .filter(e => e.decision === 'SKIPPED')
                                                    .slice(0, 5)
                                                    .map((eval_, eIdx) => (
                                                        <div key={eIdx} className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                                            • {eval_.question.slice(0, 40)}... — <span className="text-tv-yellow">{eval_.skip_reason}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <p className="text-sm">Waiting for scan activity...</p>
                            <p className="text-xs mt-1">Scans run every 30 seconds</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Snipes */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Active Snipes
                    </h2>
                    <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                        {sniperState?.active_snipes || 0} active
                    </span>
                </div>
                <div className="p-4">
                    {sniperState?.active_positions && sniperState.active_positions.length > 0 ? (
                        <div className="space-y-3">
                            {sniperState.active_positions.map((pos) => (
                                <div key={pos.id} className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-tv-yellow font-bold">🎯</span>
                                                <span className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    {pos.winner} wins
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${pos.status === 'ACTIVE' ? 'bg-tv-blue/20 text-tv-blue' : 'bg-tv-green/20 text-tv-green'}`}>
                                                    {pos.status}
                                                </span>
                                            </div>
                                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                                {pos.game}
                                            </p>
                                            <p className={`text-xs mt-1 ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                                {pos.market}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                Bid: ${pos.bid_price}
                                            </div>
                                            <div className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                                Filled: ${pos.filled.toFixed(2)}
                                            </div>
                                            <div className="text-sm text-tv-green">
                                                Expected: +${pos.expected_profit.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <p className="text-sm">Hunting for opportunities...</p>
                            <p className="text-xs mt-1">Active snipes will appear here when games end</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Snipes */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Completed Snipes
                    </h2>
                </div>
                <div className="p-4">
                    {sniperState?.recent_snipes && sniperState.recent_snipes.length > 0 ? (
                        <div className="space-y-2">
                            {sniperState.recent_snipes.map((snipe) => (
                                <div key={snipe.id} className={`p-3 rounded flex items-center justify-between ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                    <div>
                                        <div className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            {snipe.market}
                                        </div>
                                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                            Filled: ${snipe.filled.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className={`text-right ${snipe.profit >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                        {snipe.profit >= 0 ? '+' : ''}${snipe.profit.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <p className="text-sm">No completed snipes yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Configuration */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Configuration
                    </h2>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Target Bid', value: '$0.96' },
                            { label: 'Min Price', value: '$0.90' },
                            { label: 'Max Price', value: '$0.97' },
                            { label: 'Order Size', value: '$100' },
                            { label: 'Max per Market', value: '$500' },
                            { label: 'Max Exposure', value: '$2,000' },
                            { label: 'Min Margin', value: '5 pts' },
                            { label: 'Leagues', value: 'NBA, NFL' },
                        ].map((config, i) => (
                            <div key={i} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                    {config.label}
                                </div>
                                <div className={`text-sm font-medium mt-1 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                    {config.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
