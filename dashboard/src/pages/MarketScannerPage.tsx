import { useState } from 'react'
import { useBotStore } from '../stores/useBotStore'

export default function MarketScannerPage() {
    const { darkMode, gabagool, clipper } = useBotStore()
    const [filter, setFilter] = useState<'all' | 'crash' | 'arb'>('all')

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Market Scanner
                        </h1>
                        <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            Real-time view of markets being analyzed
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Gabagool Scanned
                            </div>
                            <div className={`text-lg font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                {gabagool?.markets_scanned || 0}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Clipper Scanned
                            </div>
                            <div className={`text-lg font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                {clipper?.markets_scanned || 0}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {[
                    { key: 'all', label: 'All Markets' },
                    { key: 'crash', label: 'Crash Candidates' },
                    { key: 'arb', label: 'Arb Opportunities' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key as 'all' | 'crash' | 'arb')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === key
                            ? 'bg-tv-blue text-white'
                            : darkMode
                                ? 'bg-tv-bg-secondary text-tv-text-secondary hover:bg-tv-bg-hover'
                                : 'bg-tv-light-bg-secondary text-tv-light-text-secondary hover:bg-tv-light-bg-tertiary'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Gabagool - Crash Reversion Markets */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className="font-semibold text-tv-red flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                        Gabagool - 15min Crypto Markets
                    </h2>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                        Scanning for crash reversion opportunities (price drops below $0.20 after being above $0.35)
                    </p>
                </div>

                <div className="p-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Scan Count</div>
                            <div className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                #{gabagool?.scan_count || 0}
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Markets Found</div>
                            <div className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                {gabagool?.markets_scanned || 0}
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Open Positions</div>
                            <div className={`text-xl font-bold text-tv-blue`}>
                                {gabagool?.open_positions?.length || 0}
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Total Trades</div>
                            <div className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                {gabagool?.recent_trades?.length || 0}
                            </div>
                        </div>
                    </div>

                    {/* Current Positions */}
                    {gabagool?.open_positions && gabagool.open_positions.length > 0 && (
                        <div className="mb-4">
                            <h3 className={`text-sm font-medium mb-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Active Positions
                            </h3>
                            <div className="space-y-2">
                                {gabagool.open_positions.map((pos, i) => (
                                    <div key={pos.id || i} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-medium text-tv-blue">{pos.asset}</span>
                                                <span className={`ml-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>{pos.outcome}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    Entry: ${pos.entry_price?.toFixed(3)}
                                                </div>
                                                <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                                    {pos.quantity?.toFixed(1)} shares
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Placeholder for live market data */}
                    <div className={`p-8 text-center rounded-lg border-2 border-dashed ${darkMode ? 'border-tv-border text-tv-text-tertiary' : 'border-tv-light-border text-tv-light-text-secondary'}`}>
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-sm font-medium">Live market data coming soon</p>
                        <p className="text-xs mt-1">Real-time BTC, ETH, SOL, XRP price feeds</p>
                    </div>
                </div>
            </div>

            {/* Clipper - Arbitrage Opportunities */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className="font-semibold text-tv-green flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Clipper - Arbitrage Scanner
                    </h2>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                        Scanning for YES + NO &lt; 100% opportunities across all binary markets
                    </p>
                </div>

                <div className="p-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Scan Count</div>
                            <div className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                #{clipper?.scan_count || 0}
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Markets Found</div>
                            <div className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                {clipper?.markets_scanned || 0}
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Open Arbs</div>
                            <div className={`text-xl font-bold text-tv-green`}>
                                {clipper?.open_arbs || 0}
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Opps Detected</div>
                            <div className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                {clipper?.recent_opportunities?.length || 0}
                            </div>
                        </div>
                    </div>

                    {/* Recent Opportunities */}
                    {clipper?.recent_opportunities && clipper.recent_opportunities.length > 0 && (
                        <div>
                            <h3 className={`text-sm font-medium mb-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Recent Opportunities (Last 50)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                            <th className="text-left py-2 px-3">Market</th>
                                            <th className="text-right py-2 px-3">YES</th>
                                            <th className="text-right py-2 px-3">NO</th>
                                            <th className="text-right py-2 px-3">Sum</th>
                                            <th className="text-right py-2 px-3">Arb %</th>
                                            <th className="text-right py-2 px-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clipper.recent_opportunities.slice(0, 20).map((opp, i) => (
                                            <tr
                                                key={i}
                                                className={`border-t ${darkMode ? 'border-tv-border hover:bg-tv-bg-hover' : 'border-tv-light-border hover:bg-tv-light-bg-tertiary'}`}
                                            >
                                                <td className={`py-2 px-3 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    <div className="max-w-xs truncate" title={opp.question}>
                                                        {opp.question || opp.market_slug}
                                                    </div>
                                                </td>
                                                <td className={`text-right py-2 px-3 font-mono ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    ${opp.yes_ask?.toFixed(3)}
                                                </td>
                                                <td className={`text-right py-2 px-3 font-mono ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    ${opp.no_ask?.toFixed(3)}
                                                </td>
                                                <td className={`text-right py-2 px-3 font-mono ${opp.total < 1 ? 'text-tv-green' : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                    ${opp.total?.toFixed(3)}
                                                </td>
                                                <td className={`text-right py-2 px-3 font-mono ${opp.arb_pct > 0 ? 'text-tv-green' : darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                                    {(opp.arb_pct * 100).toFixed(2)}%
                                                </td>
                                                <td className="text-right py-2 px-3">
                                                    <span className={`text-xs px-2 py-1 rounded ${opp.action === 'TAKEN'
                                                        ? 'bg-tv-green/20 text-tv-green'
                                                        : darkMode
                                                            ? 'bg-tv-bg-tertiary text-tv-text-tertiary'
                                                            : 'bg-tv-light-bg-tertiary text-tv-light-text-secondary'
                                                        }`}>
                                                        {opp.action}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {(!clipper?.recent_opportunities || clipper.recent_opportunities.length === 0) && (
                        <div className={`p-8 text-center rounded-lg border-2 border-dashed ${darkMode ? 'border-tv-border text-tv-text-tertiary' : 'border-tv-light-border text-tv-light-text-secondary'}`}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-sm font-medium">Scanning for opportunities...</p>
                            <p className="text-xs mt-1">Arbitrage opportunities will appear here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
