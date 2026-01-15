import { useBotStore } from '../stores/useBotStore'

export default function ClipperPage() {
    const { darkMode, clipper } = useBotStore()

    const formatUSD = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

    const formatPnL = (value: number) =>
        (value >= 0 ? '+' : '') + formatUSD(value)

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tv-green to-emerald-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                The Clipper
                            </h1>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Arbitrage Strategy
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${clipper?.status === 'running' ? 'bg-tv-green pulse-dot' : 'bg-tv-text-tertiary'}`} />
                        <span className={`text-sm font-medium ${clipper?.status === 'running' ? 'text-tv-green' : darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {clipper?.status === 'running' ? 'Running' : 'Stopped'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Cash', value: formatUSD(clipper?.cash || 0) },
                    { label: 'Locked in Arbs', value: formatUSD(clipper?.locked_in_arbs || 0) },
                    { label: 'Total Value', value: formatUSD(clipper?.total_value || 1000) },
                    { label: 'Realized P&L', value: formatPnL(clipper?.realized_pnl || 0), isPnl: true },
                ].map((stat, i) => (
                    <div key={i} className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {stat.label}
                        </div>
                        <div className={`text-xl font-bold mt-1 ${stat.isPnl ? ((clipper?.realized_pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red') : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Strategy Parameters */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Strategy Parameters
                    </h2>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Min Arb %', value: '1%' },
                            { label: 'Slippage Est.', value: '0.1%' },
                            { label: 'Min Liquidity', value: '$50' },
                            { label: 'Max Open Arbs', value: '5' },
                        ].map((param, i) => (
                            <div key={i} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                    {param.label}
                                </div>
                                <div className={`text-sm font-medium mt-1 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                    {param.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Position Tiers */}
                    <div className="mt-4">
                        <h3 className={`text-sm font-medium mb-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            Position Size Tiers
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
                            {[
                                { pct: '1-2%', size: '$50' },
                                { pct: '2-3%', size: '$200' },
                                { pct: '3-4%', size: '$400' },
                                { pct: '4-5%', size: '$600' },
                                { pct: '5%+', size: '$1000' },
                            ].map((tier, i) => (
                                <div key={i} className={`p-2 rounded text-center ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                    <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                        {tier.pct}
                                    </div>
                                    <div className={`text-sm font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                        {tier.size}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Open Arbitrage Positions */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Open Arbitrage Positions
                    </h2>
                    <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                        {clipper?.open_arbs || 0} / 5
                    </span>
                </div>
                <div className="p-4">
                    {clipper?.open_positions && clipper.open_positions.length > 0 ? (
                        <div className="space-y-3">
                            {clipper.open_positions.filter(p => p.status === 'OPEN').map((pos, i) => (
                                <div key={pos.arb_id || i} className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className={`text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                {pos.question || pos.market_slug}
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-xs">
                                                <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                    YES: ${pos.yes_price?.toFixed(3)}
                                                </span>
                                                <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                    NO: ${pos.no_price?.toFixed(3)}
                                                </span>
                                                <span className="text-tv-green font-medium">
                                                    Arb: {((pos.arb_pct || 0) * 100).toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                Cost: ${pos.total_cost?.toFixed(2)}
                                            </div>
                                            <div className="text-sm text-tv-green">
                                                Expected: +${pos.expected_pnl?.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-sm">No open arb positions</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Opportunities */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Recent Opportunities
                    </h2>
                </div>
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                        <thead className={`sticky top-0 ${darkMode ? 'bg-tv-bg-secondary' : 'bg-tv-light-bg-secondary'}`}>
                            <tr className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                <th className="text-left py-2 px-4">Time</th>
                                <th className="text-left py-2 px-4">Market</th>
                                <th className="text-right py-2 px-4">YES</th>
                                <th className="text-right py-2 px-4">NO</th>
                                <th className="text-right py-2 px-4">Sum</th>
                                <th className="text-right py-2 px-4">Arb %</th>
                                <th className="text-right py-2 px-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? 'divide-tv-border' : 'divide-tv-light-border'}`}>
                            {clipper?.recent_opportunities && clipper.recent_opportunities.length > 0 ? (
                                clipper.recent_opportunities.map((opp, i) => (
                                    <tr key={i} className={darkMode ? 'hover:bg-tv-bg-hover' : 'hover:bg-tv-light-bg-tertiary'}>
                                        <td className={`py-2 px-4 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                            {new Date(opp.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                        </td>
                                        <td className={`py-2 px-4 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            <div className="max-w-xs truncate" title={opp.question}>
                                                {opp.question || opp.market_slug}
                                            </div>
                                        </td>
                                        <td className={`py-2 px-4 text-right font-mono ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            ${opp.yes_ask?.toFixed(3)}
                                        </td>
                                        <td className={`py-2 px-4 text-right font-mono ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            ${opp.no_ask?.toFixed(3)}
                                        </td>
                                        <td className={`py-2 px-4 text-right font-mono ${opp.total < 1 ? 'text-tv-green' : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            ${opp.total?.toFixed(3)}
                                        </td>
                                        <td className={`py-2 px-4 text-right font-mono ${opp.arb_pct > 0 ? 'text-tv-green' : darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                            {(opp.arb_pct * 100).toFixed(2)}%
                                        </td>
                                        <td className="py-2 px-4 text-right">
                                            <span className={`text-xs px-2 py-1 rounded ${opp.action === 'TAKEN'
                                                    ? 'bg-tv-green/20 text-tv-green'
                                                    : darkMode
                                                        ? 'bg-tv-bg-tertiary text-tv-text-tertiary'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {opp.action}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className={`py-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                        No opportunities detected yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
