import { useState, useEffect } from 'react'
import { useBotStore } from '../stores/useBotStore'

type LogLevel = 'all' | 'trade' | 'info' | 'error'

interface LogEntry {
    timestamp: string
    level: 'TRADE' | 'INFO' | 'ALERT' | 'ERROR'
    bot: 'gabagool' | 'clipper' | 'sniper' | 'system'
    message: string
    data?: Record<string, unknown>
}

interface DBEvent {
    timestamp: string
    bot: string
    event_type: string
    level: string
    message: string
    metadata?: Record<string, unknown>
}

interface DBTrade {
    timestamp: string
    bot: string
    action: string
    market_slug: string
    asset?: string
    outcome?: string
    side?: string
    price: number
    quantity?: number
    value?: number
    pnl: number
    reason?: string
    metadata?: Record<string, unknown>
}

export default function ActivityLogPage() {
    const { darkMode, gabagool, clipper, tradeFeed } = useBotStore()
    const [level, setLevel] = useState<LogLevel>('all')
    const [search, setSearch] = useState('')
    const [dbEvents, setDbEvents] = useState<DBEvent[]>([])
    const [dbTrades, setDbTrades] = useState<DBTrade[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch historical data from database
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const [eventsRes, tradesRes] = await Promise.all([
                    fetch('/api/history/events?limit=200'),
                    fetch('/api/history/trades?limit=200')
                ])

                if (eventsRes.ok) {
                    const data = await eventsRes.json()
                    setDbEvents(data.events || [])
                }

                if (tradesRes.ok) {
                    const data = await tradesRes.json()
                    setDbTrades(data.trades || [])
                }
            } catch (err) {
                console.error('Failed to fetch history:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchHistory()
        // Refresh every 10 seconds
        const interval = setInterval(fetchHistory, 10000)
        return () => clearInterval(interval)
    }, [])

    // Construct logs from available data (both real-time and database)
    const logs: LogEntry[] = [
        // Database events
        ...dbEvents.map(event => ({
            timestamp: event.timestamp,
            level: (event.level === 'ERROR' ? 'ERROR' : event.level === 'ALERT' ? 'ALERT' : 'INFO') as 'INFO' | 'ALERT' | 'ERROR',
            bot: (event.bot as 'gabagool' | 'clipper' | 'sniper') || 'system',
            message: `[${event.event_type}] ${event.message}`,
            data: event.metadata,
        })),
        // Database trades
        ...dbTrades.map(trade => ({
            timestamp: trade.timestamp,
            level: 'TRADE' as const,
            bot: (trade.bot as 'gabagool' | 'clipper' | 'sniper') || 'system',
            message: trade.action === 'OPEN_ARB'
                ? `Opened arb position on ${trade.market_slug?.slice(0, 30)}...`
                : trade.action === 'SETTLE'
                    ? `Settled arb: P&L ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl?.toFixed(2)}`
                    : trade.action === 'SNIPE_PLACED'
                        ? `Snipe placed: ${trade.reason} @ $${trade.price?.toFixed(3)}`
                        : trade.action === 'SNIPE_FILL'
                            ? `Snipe filled: ${trade.quantity?.toFixed(1)} shares @ $${trade.price?.toFixed(3)}`
                            : `${trade.action} ${trade.asset || ''} ${trade.outcome || ''} @ $${trade.price?.toFixed(3)}`,
            data: trade as unknown as Record<string, unknown>,
        })),
        // Real-time trade feed (for very recent trades not yet in DB)
        ...tradeFeed.map(trade => ({
            timestamp: trade.timestamp,
            level: 'TRADE' as const,
            bot: (trade.bot as 'gabagool' | 'clipper' | 'sniper') || 'system',
            message: trade.action === 'OPEN_ARB'
                ? `Opened arb position on ${trade.market_slug?.slice(0, 30)}...`
                : trade.action === 'SETTLE'
                    ? `Settled arb: P&L ${trade.actual_pnl && trade.actual_pnl >= 0 ? '+' : ''}$${trade.actual_pnl?.toFixed(2)}`
                    : `${trade.side} ${trade.asset} ${trade.outcome} @ $${trade.price?.toFixed(3)}`,
            data: trade as unknown as Record<string, unknown>,
        })),
        // System status from bot states
        ...[
            gabagool?.status === 'running' ? {
                timestamp: new Date().toISOString(),
                level: 'INFO' as const,
                bot: 'gabagool' as const,
                message: `Scan #${gabagool.scan_count} - ${gabagool.markets_scanned} markets scanned`,
            } : null,
            clipper?.status === 'running' ? {
                timestamp: new Date().toISOString(),
                level: 'INFO' as const,
                bot: 'clipper' as const,
                message: `Scan #${clipper.scan_count} - ${clipper.markets_scanned} markets scanned`,
            } : null,
        ].filter(Boolean) as LogEntry[],
    ]
        // Dedupe by timestamp + message
        .filter((log, index, self) =>
            index === self.findIndex(l => l.timestamp === log.timestamp && l.message === log.message)
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const filteredLogs = logs.filter(log => {
        if (level !== 'all' && log.level.toLowerCase() !== level) return false
        if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
    }

    const getLevelColor = (logLevel: string) => {
        switch (logLevel) {
            case 'TRADE': return 'text-tv-blue bg-tv-blue/20'
            case 'INFO': return darkMode ? 'text-tv-text-secondary bg-tv-bg-tertiary' : 'text-tv-light-text-secondary bg-gray-100'
            case 'ALERT': return 'text-tv-yellow bg-tv-yellow/20'
            case 'ERROR': return 'text-tv-red bg-tv-red/20'
            default: return darkMode ? 'text-tv-text-secondary bg-tv-bg-tertiary' : 'text-tv-light-text-secondary bg-gray-100'
        }
    }

    const getBotColor = (bot: string) => {
        switch (bot) {
            case 'gabagool': return 'text-tv-red bg-tv-red/20'
            case 'clipper': return 'text-tv-green bg-tv-green/20'
            case 'sniper': return 'text-tv-blue bg-tv-blue/20'
            default: return darkMode ? 'text-tv-text-secondary bg-tv-bg-tertiary' : 'text-tv-light-text-secondary bg-gray-100'
        }
    }

    const getBotLabel = (bot: string) => {
        switch (bot) {
            case 'gabagool': return 'GAB'
            case 'clipper': return 'CLIP'
            case 'sniper': return 'SNIPE'
            default: return 'SYS'
        }
    }

    const handleExportCSV = async () => {
        try {
            const response = await fetch('/api/export/trades?limit=10000')
            if (!response.ok) throw new Error('Export failed')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            console.error('Export failed:', err)
        }
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Activity Log
                        </h1>
                        <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            System events, trades, and alerts (persisted to database)
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {loading ? 'Loading...' : `${filteredLogs.length} entries`}
                        </span>
                        <button
                            onClick={handleExportCSV}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                darkMode
                                    ? 'bg-tv-bg-tertiary text-tv-text-primary hover:bg-tv-bg-hover border border-tv-border'
                                    : 'bg-tv-light-bg-tertiary text-tv-light-text-primary hover:bg-gray-200 border border-tv-light-border'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                {/* Level Filter */}
                <div className="flex gap-2">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'trade', label: 'Trades' },
                        { key: 'info', label: 'Info' },
                        { key: 'error', label: 'Errors' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setLevel(key as LogLevel)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${level === key
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

                {/* Search */}
                <div className="flex-1 min-w-64">
                    <div className="relative">
                        <svg
                            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors ${darkMode
                                    ? 'bg-tv-bg-secondary border-tv-border text-tv-text-primary placeholder-tv-text-tertiary focus:border-tv-blue'
                                    : 'bg-tv-light-bg-secondary border-tv-light-border text-tv-light-text-primary placeholder-gray-400 focus:border-tv-blue'
                                } outline-none`}
                        />
                    </div>
                </div>
            </div>

            {/* Log List */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center">
                        <svg className={`w-12 h-12 mx-auto mb-3 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            {loading ? 'Loading logs from database...' : 'No log entries to show'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-tv-border max-h-[600px] overflow-y-auto font-mono text-sm">
                        {filteredLogs.map((log, i) => (
                            <div
                                key={`${log.timestamp}-${i}`}
                                className={`p-3 ${darkMode ? 'hover:bg-tv-bg-hover' : 'hover:bg-tv-light-bg-tertiary'} transition-colors`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Timestamp */}
                                    <span className={`flex-shrink-0 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`}>
                                        {formatTime(log.timestamp)}
                                    </span>

                                    {/* Level Badge */}
                                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded ${getLevelColor(log.level)}`}>
                                        {log.level}
                                    </span>

                                    {/* Bot Badge */}
                                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded uppercase ${getBotColor(log.bot)}`}>
                                        {getBotLabel(log.bot)}
                                    </span>

                                    {/* Message */}
                                    <span className={`flex-1 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                        {log.message}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Database status indicator */}
            <div className={`p-4 rounded-lg border ${darkMode ? 'border-tv-border bg-tv-bg-tertiary' : 'border-tv-light-border bg-gray-50'} text-center text-sm`}>
                <p className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                    Logs are persisted to PostgreSQL and survive restarts. Auto-refreshes every 10 seconds.
                </p>
            </div>
        </div>
    )
}
