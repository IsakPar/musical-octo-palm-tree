import { useState } from 'react'
import { useBotStore } from '../stores/useBotStore'

interface BacktestResult {
    success: boolean
    days: number
    ticks_processed: number
    starting_balance: string
    final_balance: string
    total_pnl: string
    total_return_pct: number
    total_trades: number
    win_rate: number
    profit_factor: number
    sharpe_ratio: number
    sortino_ratio: number
    max_drawdown_pct: number
    avg_win: string
    avg_loss: string
    largest_win: string
    largest_loss: string
    expectancy: string
}

export default function SynthArbPage() {
    const { darkMode, synthArb } = useBotStore()
    const [backtestLoading, setBacktestLoading] = useState(false)
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
    const [backtestError, setBacktestError] = useState<string | null>(null)
    const [selectedDays, setSelectedDays] = useState(7)

    const runBacktest = async () => {
        setBacktestLoading(true)
        setBacktestError(null)
        setBacktestResult(null)

        try {
            const response = await fetch('/api/synth-arb/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: selectedDays, markets: 20 })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Backtest failed')
            }

            const result = await response.json()
            setBacktestResult(result)
        } catch (err) {
            setBacktestError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setBacktestLoading(false)
        }
    }

    const formatUSD = (value: number | string) => {
        const num = typeof value === 'string' ? parseFloat(value) : value
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
    }

    const formatPnL = (value: number | string) => {
        const num = typeof value === 'string' ? parseFloat(value) : value
        return (num >= 0 ? '+' : '') + formatUSD(num)
    }

    const formatPercent = (value: number) =>
        `${value.toFixed(1)}%`

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tv-purple to-indigo-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                Synth-Arb Bot
                            </h1>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Synthetic Arbitrage - YES + NO != $1.00
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${synthArb?.status === 'running' ? 'bg-tv-purple pulse-dot' : 'bg-tv-text-tertiary'}`} />
                        <span className={`text-sm font-medium ${synthArb?.status === 'running' ? 'text-tv-purple' : darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {synthArb?.status === 'running' ? 'Running' : synthArb?.status === 'disconnected' ? 'Disconnected' : 'Stopped'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Cash', value: formatUSD(synthArb?.cash || 0) },
                    { label: 'Total Exposure', value: formatUSD(synthArb?.total_exposure || 0) },
                    { label: 'Total Value', value: formatUSD(synthArb?.total_value || 0) },
                    { label: 'Realized P&L', value: formatPnL(synthArb?.realized_pnl || 0), isPnl: true },
                ].map((stat, i) => (
                    <div key={i} className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {stat.label}
                        </div>
                        <div className={`text-xl font-bold mt-1 ${stat.isPnl ? (parseFloat(String(synthArb?.realized_pnl || 0)) >= 0 ? 'text-tv-green' : 'text-tv-red') : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Trades', value: synthArb?.trades_count || 0 },
                    { label: 'Wins', value: synthArb?.wins || 0, color: 'text-tv-green' },
                    { label: 'Losses', value: synthArb?.losses || 0, color: 'text-tv-red' },
                    { label: 'Win Rate', value: formatPercent(synthArb?.win_rate || 0), highlight: true },
                ].map((stat, i) => (
                    <div key={i} className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {stat.label}
                        </div>
                        <div className={`text-xl font-bold mt-1 ${stat.color || (stat.highlight ? 'text-tv-purple' : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary')}`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Market Connection Status */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Connection Stats
                    </h2>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Markets Tracked', value: synthArb?.markets_count || 0 },
                            { label: 'Messages Received', value: (synthArb?.messages_received || 0).toLocaleString() },
                            { label: 'WebSocket Status', value: synthArb?.status === 'running' ? 'Connected' : 'Disconnected', isStatus: true },
                        ].map((stat, i) => (
                            <div key={i} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                    {stat.label}
                                </div>
                                <div className={`text-sm font-medium mt-1 ${stat.isStatus ? (synthArb?.status === 'running' ? 'text-tv-green' : 'text-tv-red') : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
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
                            { label: 'Buy Threshold', value: '< $0.98', desc: 'YES + NO total' },
                            { label: 'Sell Threshold', value: '> $1.02', desc: 'YES + NO total' },
                            { label: 'Order Size', value: '$100', desc: 'Per trade' },
                            { label: 'Max Position', value: '$500', desc: 'Per market' },
                            { label: 'Max Exposure', value: '$2,000', desc: 'Total portfolio' },
                            { label: 'Slippage Model', value: '0.5%', desc: 'Mock execution' },
                            { label: 'Fill Probability', value: '95%', desc: 'Simulated fills' },
                            { label: 'Mode', value: 'Paper Trading', desc: 'No real orders' },
                        ].map((param, i) => (
                            <div key={i} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                    {param.label}
                                </div>
                                <div className={`text-sm font-medium mt-1 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                    {param.value}
                                </div>
                                <div className={`text-xs mt-0.5 ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                    {param.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Backtest Panel */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Strategy Backtest
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            {[7, 14, 30].map(days => (
                                <button
                                    key={days}
                                    onClick={() => setSelectedDays(days)}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${
                                        selectedDays === days
                                            ? 'bg-tv-purple text-white'
                                            : darkMode
                                                ? 'bg-tv-bg-tertiary text-tv-text-secondary hover:text-tv-text-primary'
                                                : 'bg-tv-light-bg-tertiary text-tv-light-text-secondary hover:text-tv-light-text-primary'
                                    }`}
                                >
                                    {days}d
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={runBacktest}
                            disabled={backtestLoading}
                            className={`px-4 py-1.5 rounded font-medium text-sm transition-all ${
                                backtestLoading
                                    ? 'bg-tv-purple/50 text-white/50 cursor-not-allowed'
                                    : 'bg-tv-purple text-white hover:bg-tv-purple/90'
                            }`}
                        >
                            {backtestLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Running...
                                </span>
                            ) : (
                                'Run Backtest'
                            )}
                        </button>
                    </div>
                </div>
                <div className="p-4">
                    {backtestError && (
                        <div className="mb-4 p-3 rounded-lg bg-tv-red/10 border border-tv-red/20 text-tv-red text-sm">
                            {backtestError}
                        </div>
                    )}

                    {backtestResult ? (
                        <div className="space-y-4">
                            {/* Summary Header */}
                            <div className={`p-4 rounded-lg ${parseFloat(backtestResult.total_pnl) >= 0 ? 'bg-tv-green/10' : 'bg-tv-red/10'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                            {backtestResult.days}-Day Backtest Result
                                        </div>
                                        <div className={`text-2xl font-bold ${parseFloat(backtestResult.total_pnl) >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                            {parseFloat(backtestResult.total_pnl) >= 0 ? '+' : ''}{formatUSD(backtestResult.total_pnl)}
                                        </div>
                                        <div className={`text-sm ${parseFloat(backtestResult.total_pnl) >= 0 ? 'text-tv-green/80' : 'text-tv-red/80'}`}>
                                            {backtestResult.total_return_pct >= 0 ? '+' : ''}{backtestResult.total_return_pct.toFixed(2)}% return
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                            {backtestResult.ticks_processed.toLocaleString()} ticks processed
                                        </div>
                                        <div className={`text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            {formatUSD(backtestResult.starting_balance)} → {formatUSD(backtestResult.final_balance)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Total Trades', value: backtestResult.total_trades },
                                    { label: 'Win Rate', value: `${backtestResult.win_rate.toFixed(1)}%`, highlight: backtestResult.win_rate > 50 },
                                    { label: 'Profit Factor', value: backtestResult.profit_factor.toFixed(2), highlight: backtestResult.profit_factor > 1.5 },
                                    { label: 'Max Drawdown', value: `${backtestResult.max_drawdown_pct.toFixed(1)}%`, bad: backtestResult.max_drawdown_pct > 10 },
                                    { label: 'Sharpe Ratio', value: backtestResult.sharpe_ratio.toFixed(2), highlight: backtestResult.sharpe_ratio > 1 },
                                    { label: 'Sortino Ratio', value: backtestResult.sortino_ratio.toFixed(2), highlight: backtestResult.sortino_ratio > 1 },
                                    { label: 'Avg Win', value: formatUSD(backtestResult.avg_win), good: true },
                                    { label: 'Avg Loss', value: formatUSD(backtestResult.avg_loss), bad: true },
                                    { label: 'Largest Win', value: formatUSD(backtestResult.largest_win), good: true },
                                    { label: 'Largest Loss', value: formatUSD(backtestResult.largest_loss), bad: true },
                                    { label: 'Expectancy', value: formatUSD(backtestResult.expectancy), isPnl: true },
                                ].map((metric, i) => (
                                    <div key={i} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                        <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                            {metric.label}
                                        </div>
                                        <div className={`text-sm font-medium mt-1 ${
                                            metric.isPnl ? (parseFloat(backtestResult.expectancy) >= 0 ? 'text-tv-green' : 'text-tv-red') :
                                            metric.highlight ? 'text-tv-purple' :
                                            metric.good ? 'text-tv-green' :
                                            metric.bad ? 'text-tv-red' :
                                            darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'
                                        }`}>
                                            {metric.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-sm">Run a backtest to simulate strategy performance</p>
                            <p className="text-xs mt-1 opacity-75">Select time period and click "Run Backtest"</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Risk Metrics */}
            {synthArb?.metrics && (
                <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                        <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Risk Metrics
                        </h2>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Sharpe Ratio', value: synthArb.metrics.sharpe_ratio.toFixed(2), highlight: synthArb.metrics.sharpe_ratio > 1 },
                                { label: 'Sortino Ratio', value: synthArb.metrics.sortino_ratio.toFixed(2), highlight: synthArb.metrics.sortino_ratio > 1 },
                                { label: 'Profit Factor', value: synthArb.metrics.profit_factor.toFixed(2), highlight: synthArb.metrics.profit_factor > 1.5 },
                                { label: 'Max Drawdown', value: `${synthArb.metrics.max_drawdown_pct.toFixed(1)}%`, bad: synthArb.metrics.max_drawdown_pct > 10 },
                                { label: 'Current DD', value: `${synthArb.metrics.current_drawdown_pct.toFixed(1)}%`, bad: synthArb.metrics.current_drawdown_pct > 5 },
                                { label: 'Avg Win', value: formatUSD(synthArb.metrics.avg_win), good: true },
                                { label: 'Avg Loss', value: formatUSD(synthArb.metrics.avg_loss), bad: true },
                                { label: 'Expectancy', value: formatUSD(synthArb.metrics.expectancy), isPnl: true },
                                { label: 'Win Streak', value: `${synthArb.metrics.consecutive_wins} (max: ${synthArb.metrics.max_consecutive_wins})` },
                                { label: 'Loss Streak', value: `${synthArb.metrics.consecutive_losses} (max: ${synthArb.metrics.max_consecutive_losses})` },
                                { label: 'Largest Win', value: formatUSD(synthArb.metrics.largest_win), good: true },
                                { label: 'Largest Loss', value: formatUSD(synthArb.metrics.largest_loss), bad: true },
                            ].map((metric, i) => (
                                <div key={i} className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                                    <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                        {metric.label}
                                    </div>
                                    <div className={`text-sm font-medium mt-1 ${
                                        metric.isPnl ? (parseFloat(String(synthArb.metrics?.expectancy || 0)) >= 0 ? 'text-tv-green' : 'text-tv-red') :
                                        metric.highlight ? 'text-tv-purple' :
                                        metric.good ? 'text-tv-green' :
                                        metric.bad ? 'text-tv-red' :
                                        darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'
                                    }`}>
                                        {metric.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Open Positions */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        Open Positions
                    </h2>
                    <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                        {synthArb?.open_positions?.length || 0} active
                    </span>
                </div>
                <div className="p-4">
                    {synthArb?.open_positions && synthArb.open_positions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                        <th className="text-left pb-3 font-medium">Condition ID</th>
                                        <th className="text-left pb-3 font-medium">Side</th>
                                        <th className="text-right pb-3 font-medium">Entry Price</th>
                                        <th className="text-right pb-3 font-medium">Size</th>
                                        <th className="text-right pb-3 font-medium">Market Value</th>
                                        <th className="text-right pb-3 font-medium">Unrealized P&L</th>
                                        <th className="text-right pb-3 font-medium">Entry Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-tv-border">
                                    {synthArb.open_positions.map((pos, i) => (
                                        <tr key={pos.condition_id || i} className={`${darkMode ? 'hover:bg-tv-bg-hover' : 'hover:bg-tv-light-bg-tertiary'}`}>
                                            <td className={`py-3 font-mono text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                {pos.condition_id.slice(0, 8)}...
                                            </td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${pos.side === 'Long' ? 'bg-tv-green/20 text-tv-green' : 'bg-tv-red/20 text-tv-red'}`}>
                                                    {pos.side}
                                                </span>
                                            </td>
                                            <td className={`py-3 text-right text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                ${parseFloat(String(pos.entry_price)).toFixed(3)}
                                            </td>
                                            <td className={`py-3 text-right text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                {parseFloat(String(pos.size)).toFixed(2)}
                                            </td>
                                            <td className={`py-3 text-right text-sm ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                                {formatUSD(pos.market_value)}
                                            </td>
                                            <td className={`py-3 text-right text-sm font-medium ${parseFloat(String(pos.unrealized_pnl)) >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                                {formatPnL(pos.unrealized_pnl)}
                                            </td>
                                            <td className={`py-3 text-right text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                                {new Date(pos.entry_time).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className={`p-8 text-center ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-sm">No open positions</p>
                            <p className="text-xs mt-1 opacity-75">Waiting for arbitrage opportunities...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Panel */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                        About Synth-Arb Strategy
                    </h2>
                </div>
                <div className={`p-4 text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                    <p className="mb-3">
                        The Synthetic Arbitrage bot exploits mispricings in Polymarket binary markets where
                        the sum of YES and NO prices deviates from $1.00.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className="font-medium text-tv-green mb-1">Buy Signal (YES + NO &lt; $0.98)</div>
                            <p className="text-xs">
                                When the market is underpriced, buy both YES and NO tokens.
                                Guaranteed $1.00 payout regardless of outcome.
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}>
                            <div className="font-medium text-tv-red mb-1">Sell Signal (YES + NO &gt; $1.02)</div>
                            <p className="text-xs">
                                When the market is overpriced, sell both YES and NO tokens if held.
                                Lock in profit before market corrects.
                            </p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs opacity-75">
                        Currently running in mock mode - all trades are simulated with realistic slippage modeling.
                    </p>
                </div>
            </div>
        </div>
    )
}
