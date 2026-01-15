import { useBotStore } from '../stores/useBotStore'

interface Props {
  bot: 'gabagool' | 'clipper' | 'sniper'
}

export default function BotPanel({ bot }: Props) {
  const { gabagool, clipper, sniper, darkMode } = useBotStore()

  const state = bot === 'gabagool' ? gabagool : bot === 'clipper' ? clipper : sniper
  const isGabagool = bot === 'gabagool'
  const isClipper = bot === 'clipper'
  const isSniper = bot === 'sniper'

  const botName = isGabagool ? 'The Gabagool' : isClipper ? 'The Clipper' : 'The Sniper'
  const botDescription = isGabagool ? 'Crash Reversion Strategy' : isClipper ? 'Arbitrage Strategy' : 'Sports Garbage Collector'
  const accentColor = isGabagool ? 'text-tv-red' : isClipper ? 'text-tv-green' : 'text-tv-blue'

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

  return (
    <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
        <div>
          <h2 className={`font-semibold ${accentColor}`}>{botName}</h2>
          <p className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
            {botDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state?.status === 'running' ? 'bg-tv-green pulse-dot' : 'bg-tv-text-tertiary'}`} />
          <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
            {state?.status === 'running' ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'} mb-1`}>
              Cash
            </div>
            <div className={`text-lg font-semibold tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
              {formatCurrency(state?.cash || 1000)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'} mb-1`}>
              {isGabagool ? 'Positions' : isClipper ? 'Locked in Arbs' : 'Exposure'}
            </div>
            <div className={`text-lg font-semibold tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
              {formatCurrency(
                isGabagool ? (state?.positions_value || 0) :
                isClipper ? (state?.locked_in_arbs || 0) :
                (state?.total_exposure || 0)
              )}
            </div>
          </div>
          <div>
            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'} mb-1`}>
              Realized P&L
            </div>
            <div className={`text-lg font-semibold tabular-nums ${
              (state?.realized_pnl || 0) >= 0 ? 'text-tv-green' : 'text-tv-red'
            }`}>
              {formatPnl(state?.realized_pnl || 0)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'} mb-1`}>
              {isGabagool ? 'Open Positions' : isClipper ? 'Open Arbs' : 'Active Snipes'}
            </div>
            <div className={`text-lg font-semibold tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
              {isGabagool
                ? state?.open_positions?.length || 0
                : isClipper
                  ? state?.open_arbs || 0
                  : state?.active_snipes || 0}
            </div>
          </div>
        </div>

        {/* Scan Stats */}
        <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              {isSniper ? 'Games Checked' : 'Markets Scanned'}
            </span>
            <span className={`text-xs tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
              {isSniper ? (state?.games_checked || 0) : (state?.markets_scanned || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              Scan Count
            </span>
            <span className={`text-xs tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
              #{state?.scan_count || 0}
            </span>
          </div>
          {isSniper && (
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                Opportunities Found
              </span>
              <span className={`text-xs tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                {state?.opportunities_found || 0}
              </span>
            </div>
          )}
        </div>

        {/* Open Positions Table */}
        {state?.open_positions && state.open_positions.length > 0 && (
          <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
            <div className={`text-xs font-medium mb-2 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              Open Positions
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {state.open_positions.map((pos, idx) => (
                <div
                  key={pos.id || pos.arb_id || idx}
                  className={`text-xs p-2 rounded ${darkMode ? 'bg-tv-bg-tertiary' : 'bg-tv-light-bg-tertiary'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}>
                      {isGabagool
                        ? `${pos.asset} ${pos.outcome}`
                        : (pos.market_slug?.slice(0, 25) + '...')}
                    </span>
                    <span className={`tabular-nums ${
                      isGabagool
                        ? ''
                        : 'text-tv-green'
                    } ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                      {isGabagool
                        ? formatCurrency(pos.entry_price || 0)
                        : `${((pos.arb_pct || 0) * 100).toFixed(2)}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
