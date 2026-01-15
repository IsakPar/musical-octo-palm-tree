import { useState, useEffect } from 'react'
import { useBotStore } from '../stores/useBotStore'

type DecisionFilter = 'all' | 'taken' | 'skipped'

interface DBDecision {
    timestamp: string
    bot: string
    market_slug: string
    question: string
    decision: string
    reason: string
    price: number
    arb_pct: number
    metadata?: Record<string, unknown>
}

export default function DecisionLogPage() {
    const { darkMode, gabagool, clipper } = useBotStore()
    const [filter, setFilter] = useState<DecisionFilter>('all')
    const [botFilter, setBotFilter] = useState<'all' | 'gabagool' | 'clipper' | 'sniper'>('all')
    const [dbDecisions, setDbDecisions] = useState<DBDecision[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch decisions from database
    useEffect(() => {
        const fetchDecisions = async () => {
            try {
                const response = await fetch('/api/history/decisions?limit=500')
                if (response.ok) {
                    const data = await response.json()
                    setDbDecisions(data.decisions || [])
                }
            } catch (err) {
                console.error('Failed to fetch decisions:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchDecisions()
        // Refresh every 10 seconds
        const interval = setInterval(fetchDecisions, 10000)
        return () => clearInterval(interval)
    }, [])

    // Combine database decisions with real-time data
    const allDecisions = [
        // Database decisions (primary source)
        ...dbDecisions.map(d => ({
            timestamp: d.timestamp,
            bot: d.bot,
            decisionType: d.decision as 'TAKEN' | 'SKIPPED',
            question: d.question,
            market_slug: d.market_slug,
            reason: d.reason,
            price: d.price,
            arb_pct: d.arb_pct,
            metadata: d.metadata,
        })),
        // Gabagool trades (all are "taken" decisions) - for real-time
        ...(gabagool?.recent_trades || []).map(trade => ({
            timestamp: trade.timestamp,
            bot: 'gabagool',
            decisionType: 'TAKEN' as const,
            question: `${trade.asset} ${trade.outcome}`,
            market_slug: trade.market_slug,
            reason: trade.reason || '',
            price: trade.price || 0,
            arb_pct: 0,
            asset: trade.asset,
            outcome: trade.outcome,
            pnl: trade.pnl,
        })),
        // Clipper opportunities - for real-time
        ...(clipper?.recent_opportunities || []).map(opp => ({
            timestamp: opp.timestamp,
            bot: 'clipper',
            decisionType: (opp.action === 'TAKEN' ? 'TAKEN' : 'SKIPPED') as 'TAKEN' | 'SKIPPED',
            question: opp.question,
            market_slug: opp.market_slug,
            reason: opp.action !== 'TAKEN' ? opp.action.replace('SKIP:', '') : 'arb_profitable',
            price: opp.total,
            arb_pct: opp.arb_pct,
            yes_ask: opp.yes_ask,
            no_ask: opp.no_ask,
            yes_liquidity: opp.yes_liquidity,
            no_liquidity: opp.no_liquidity,
        })),
    ]
        // Dedupe by timestamp + market_slug
        .filter((d, index, self) =>
            index === self.findIndex(x => x.timestamp === d.timestamp && x.market_slug === d.market_slug)
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const filteredDecisions = allDecisions.filter(d => {
        if (botFilter !== 'all' && d.bot !== botFilter) return false
        if (filter === 'taken' && d.decisionType !== 'TAKEN') return false
        if (filter === 'skipped' && d.decisionType !== 'SKIPPED') return false
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

    const takenCount = allDecisions.filter(d => d.decisionType === 'TAKEN').length
    const skippedCount = allDecisions.filter(d => d.decisionType === 'SKIPPED').length

    const getBotColor = (bot: string) => {
        switch (bot) {
            case 'gabagool': return 'bg-tv-red/20 text-tv-red'
            case 'clipper': return 'bg-tv-green/20 text-tv-green'
            case 'sniper': return 'bg-tv-blue/20 text-tv-blue'
            default: return darkMode ? 'bg-tv-bg-tertiary text-tv-text-secondary' : 'bg-gray-100 text-gray-500'
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

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border p-4`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className={`text-xl font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Decision Log
                        </h1>
                        <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            Every market evaluation and why trades were/weren't taken (persisted)
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-tv-green" />
                            <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Taken: {takenCount}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${darkMode ? 'bg-tv-text-tertiary' : 'bg-gray-400'}`} />
                            <span className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Skipped: {skippedCount}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                    {[
                        { key: 'all', label: 'All Decisions' },
                        { key: 'taken', label: 'Taken' },
                        { key: 'skipped', label: 'Skipped' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key as DecisionFilter)}
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

                <div className="flex gap-2">
                    {[
                        { key: 'all', label: 'All Bots' },
                        { key: 'gabagool', label: 'Gabagool' },
                        { key: 'clipper', label: 'Clipper' },
                        { key: 'sniper', label: 'Sniper' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setBotFilter(key as 'all' | 'gabagool' | 'clipper' | 'sniper')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${botFilter === key
                                ? key === 'gabagool'
                                    ? 'bg-tv-red text-white'
                                    : key === 'clipper'
                                        ? 'bg-tv-green text-white'
                                        : key === 'sniper'
                                            ? 'bg-tv-blue text-white'
                                            : 'bg-tv-blue text-white'
                                : darkMode
                                    ? 'bg-tv-bg-secondary text-tv-text-secondary hover:bg-tv-bg-hover'
                                    : 'bg-tv-light-bg-secondary text-tv-light-text-secondary hover:bg-tv-light-bg-tertiary'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Decision List */}
            <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
                <div className="divide-y divide-tv-border max-h-[600px] overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center">
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                Loading decisions from database...
                            </p>
                        </div>
                    ) : filteredDecisions.length === 0 ? (
                        <div className="p-8 text-center">
                            <svg className={`w-12 h-12 mx-auto mb-3 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className={`text-sm ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                                No decisions to show
                            </p>
                        </div>
                    ) : (
                        filteredDecisions.map((decision, i) => (
                            <div
                                key={`${decision.timestamp}-${i}`}
                                className={`p-4 ${darkMode ? 'hover:bg-tv-bg-hover' : 'hover:bg-tv-light-bg-tertiary'} transition-colors`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Decision Icon */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${decision.decisionType === 'TAKEN'
                                        ? 'bg-tv-green/20'
                                        : darkMode ? 'bg-tv-bg-tertiary' : 'bg-gray-100'
                                        }`}>
                                        {decision.decisionType === 'TAKEN' ? (
                                            <svg className="w-5 h-5 text-tv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg className={`w-5 h-5 ${darkMode ? 'text-tv-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Decision Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${getBotColor(decision.bot)}`}>
                                                {getBotLabel(decision.bot)}
                                            </span>
                                            <span className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                                {formatTime(decision.timestamp)}
                                            </span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${decision.decisionType === 'TAKEN'
                                                ? 'bg-tv-green/20 text-tv-green'
                                                : darkMode ? 'bg-tv-bg-tertiary text-tv-text-tertiary' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {decision.decisionType}
                                            </span>
                                        </div>

                                        <p className={`mt-1 ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                                            {decision.question || `${(decision as Record<string, unknown>).asset || ''} ${(decision as Record<string, unknown>).outcome || ''}`}
                                        </p>

                                        {/* Details */}
                                        <div className="mt-2 flex flex-wrap gap-4 text-xs">
                                            {decision.arb_pct !== undefined && decision.arb_pct !== 0 && (
                                                <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                    Arb: <span className={decision.arb_pct > 0 ? 'text-tv-green' : ''}>
                                                        {(decision.arb_pct * 100).toFixed(2)}%
                                                    </span>
                                                </span>
                                            )}
                                            {(decision as Record<string, unknown>).yes_ask !== undefined && (
                                                <>
                                                    <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                        YES: ${((decision as Record<string, unknown>).yes_ask as number)?.toFixed(3)}
                                                    </span>
                                                    <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                        NO: ${((decision as Record<string, unknown>).no_ask as number)?.toFixed(3)}
                                                    </span>
                                                </>
                                            )}
                                            {decision.price !== undefined && decision.price !== 0 && (
                                                <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                    Price: ${decision.price?.toFixed(3)}
                                                </span>
                                            )}
                                            {decision.reason && (
                                                <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                                                    Reason: <span className="text-tv-yellow">{decision.reason}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* P&L (if taken and available) */}
                                    {decision.decisionType === 'TAKEN' && (decision as Record<string, unknown>).pnl !== undefined && (
                                        <div className="text-right">
                                            <div className={`text-sm font-medium ${((decision as Record<string, unknown>).pnl as number || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                                                {((decision as Record<string, unknown>).pnl as number || 0) >= 0 ? '+' : ''}${((decision as Record<string, unknown>).pnl as number || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Database status indicator */}
            <div className={`p-4 rounded-lg border ${darkMode ? 'border-tv-border bg-tv-bg-tertiary' : 'border-tv-light-border bg-gray-50'} text-center text-sm`}>
                <p className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
                    Decisions are persisted to PostgreSQL and survive restarts. Auto-refreshes every 10 seconds.
                </p>
            </div>
        </div>
    )
}
