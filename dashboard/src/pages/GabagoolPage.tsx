import { useBotStore } from '../stores/useBotStore'

export default function GabagoolPage() {
    const { darkMode, gabagool } = useBotStore()

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
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tv-red to-orange-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                            </svg>
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                The Gabagool
                            </h1>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Crash Reversion Strategy
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${gabagool?.status === 'running' ? 'bg-tv-green pulse-dot' : 'bg-tv-text-tertiary'}`} />
                        <span className={`text-sm font-medium ${gabagool?.status === 'running' ? 'text-tv-green' : darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {gabagool?.status === 'running' ? 'Running' : 'Stopped'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Cash', value: formatUSD(gabagool?.cash || 0) },
                    { label: 'Positions Value', value: formatUSD(gabagool?.positions_value || 0) },
                    { label: 'Total Value', value: formatUSD(gabagool?.total_value || 1000) },
                    { label: 'Realized P&L', value: formatPnL(gabagool?.realized_pnl || 0), isPnl: true },
                ].map((stat, i) => (
                    <div key={i} className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {stat.label}
                        </div>
                        <div className={`text-xl font-bold mt-1 ${stat.isPnl ? ((gabagool?.realized_pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red') : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
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
                            { label: 'Crash Threshold', value: '$0.20' },
                            { label: 'Recent High Min', value: '$0.35' },
                            { label: 'Min Drop %', value: '40%' },
                            { label: 'Profit Target', value: '50%' },
                            { label: 'Stop Loss', value: '30%' },
                            { label: 'Max Position', value: '$50' },
                            { label: 'Max Open', value: '3' },
                            { label: 'Stabilization', value: '3 ticks' },
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
                </div>
            </div>

            {/* Open Positions */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Open Positions
                    </h2>
                    <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                        {gabagool?.open_positions?.length || 0} / 3
                    </span>
                </div>
                <div className="p-4">
                    {gabagool?.open_positions && gabagool.open_positions.length > 0 ? (
                        <div className="space-y-3">
                            {gabagool.open_positions.map((pos, i) => (
                                <div key={pos.id || i} className={`p-4 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-lg font-bold text-tv-blue">{pos.asset}</span>
                                            <span className={`ml-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>{pos.outcome}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                Entry: ${pos.entry_price?.toFixed(3)}
                                            </div>
                                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                                {pos.quantity?.toFixed(1)} shares @ ${((pos.entry_price || 0) * (pos.quantity || 0)).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-sm">No open positions</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Trade History */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Trade History
                    </h2>
                </div>
                <div className="divide-y divide-tv-border max-h-96 overflow-y-auto">
                    {gabagool?.recent_trades && gabagool.recent_trades.length > 0 ? (
                        gabagool.recent_trades.map((trade, i) => (
                            <div key={i} className={`p-4 ${darkMode ? 'hover:bg-tv-bg-hover' : 'hover:bg-tv-light-bg-tertiary'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded flex items-center justify-center ${trade.side === 'BUY' ? 'bg-tv-blue/20' : (trade.pnl || 0) >= 0 ? 'bg-tv-green/20' : 'bg-tv-red/20'
                                            }`}>
                                            {trade.side === 'BUY' ? (
                                                <svg className="w-4 h-4 text-tv-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                            ) : (
                                                <svg className={`w-4 h-4 ${(trade.pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                </svg>
                                            )}
                                        </div>
                                        <div>
                                            <div className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                {trade.side} {trade.asset} {trade.outcome}
                                            </div>
                                            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                                {new Date(trade.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            ${trade.price?.toFixed(3)}
                                        </div>
                                        {trade.side === 'SELL' && (
                                            <div className={`text-sm ${(trade.pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                                {formatPnL(trade.pnl || 0)}
                                            </div>
                                        )}
                                        {trade.reason && (
                                            <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                                {trade.reason}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <p className="text-sm">No trades yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
