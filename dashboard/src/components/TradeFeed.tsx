import { useBotStore } from '../stores/useBotStore'

export default function TradeFeed() {
  const { tradeFeed, gabagool, clipper, darkMode } = useBotStore()

  // Combine recent trades from both bots
  const allTrades = [
    ...(gabagool?.recent_trades?.map(t => ({ ...t, bot: 'gabagool' })) || []),
    ...(clipper?.recent_trades?.map(t => ({ ...t, bot: 'clipper' })) || []),
    ...tradeFeed,
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50)

  // Remove duplicates by timestamp
  const uniqueTrades = allTrades.filter((trade, index, self) =>
    index === self.findIndex(t => t.timestamp === trade.timestamp && t.bot === trade.bot)
  )

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const getTradeIcon = (trade: typeof uniqueTrades[0]) => {
    if (trade.bot === 'clipper') {
      if (trade.action === 'OPEN_ARB') {
        return (
          <div className="w-6 h-6 rounded bg-tv-green/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-tv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        )
      } else if (trade.action === 'SETTLE') {
        return (
          <div className={`w-6 h-6 rounded flex items-center justify-center ${
            (trade.actual_pnl || 0) >= 0 ? 'bg-tv-green/20' : 'bg-tv-red/20'
          }`}>
            <svg className={`w-4 h-4 ${(trade.actual_pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      }
    }

    // Gabagool trades
    if (trade.side === 'BUY') {
      return (
        <div className="w-6 h-6 rounded bg-tv-blue/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-tv-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      )
    } else {
      return (
        <div className={`w-6 h-6 rounded flex items-center justify-center ${
          (trade.pnl || 0) >= 0 ? 'bg-tv-green/20' : 'bg-tv-red/20'
        }`}>
          <svg className={`w-4 h-4 ${(trade.pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </div>
      )
    }
  }

  const getTradeDescription = (trade: typeof uniqueTrades[0]) => {
    if (trade.bot === 'clipper') {
      if (trade.action === 'OPEN_ARB') {
        return `Opened arbitrage on ${trade.market_slug?.slice(0, 30)}...`
      } else if (trade.action === 'SETTLE') {
        return `Settled: ${trade.market_slug?.slice(0, 30)}...`
      }
    }

    // Gabagool
    return `${trade.side} ${trade.asset} ${trade.outcome} @ ${formatCurrency(trade.price || 0)}`
  }

  const getTradePnl = (trade: typeof uniqueTrades[0]) => {
    if (trade.bot === 'clipper') {
      if (trade.action === 'OPEN_ARB') {
        return { value: trade.expected_pnl || 0, label: 'expected' }
      } else if (trade.action === 'SETTLE') {
        return { value: trade.actual_pnl || 0, label: 'realized' }
      }
    }

    // Gabagool
    if (trade.side === 'SELL') {
      return { value: trade.pnl || 0, label: 'realized' }
    }

    return null
  }

  return (
    <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border h-full flex flex-col`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-tv-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
            Live Trade Feed
          </h2>
        </div>
        <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
          {uniqueTrades.length} trades
        </span>
      </div>

      {/* Trade List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {uniqueTrades.length === 0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No trades yet</p>
            <p className="text-xs mt-1">Trades will appear here in real-time</p>
          </div>
        ) : (
          uniqueTrades.map((trade, idx) => {
            const pnlInfo = getTradePnl(trade)

            return (
              <div
                key={`${trade.timestamp}-${trade.bot}-${idx}`}
                className={`p-3 rounded-lg trade-item-enter ${darkMode ? 'bg-tv-bg-tertiary hover:bg-tv-bg-hover' : 'bg-tv-light-bg-tertiary hover:bg-tv-light-bg-secondary'} transition-colors`}
              >
                <div className="flex items-start gap-3">
                  {getTradeIcon(trade)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        trade.bot === 'gabagool'
                          ? 'bg-tv-red/20 text-tv-red'
                          : 'bg-tv-green/20 text-tv-green'
                      }`}>
                        {trade.bot === 'gabagool' ? 'GAB' : 'CLIP'}
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                        {formatTime(trade.timestamp)}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 truncate ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                      {getTradeDescription(trade)}
                    </p>
                    {pnlInfo && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-medium tabular-nums ${
                          pnlInfo.value >= 0 ? 'text-tv-green' : 'text-tv-red'
                        }`}>
                          {pnlInfo.value >= 0 ? '+' : ''}{formatCurrency(pnlInfo.value)}
                        </span>
                        <span className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                          {pnlInfo.label}
                        </span>
                      </div>
                    )}
                    {trade.reason && (
                      <span className={`text-xs mt-1 inline-block ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                        {trade.reason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
