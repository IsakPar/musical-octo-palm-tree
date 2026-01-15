import { useBotStore } from '../stores/useBotStore'

export default function CombinedStats() {
  const { gabagool, clipper, sniper, darkMode } = useBotStore()

  const gabValue = gabagool?.total_value || 1000
  const clipValue = clipper?.total_value || 1000
  const sniperValue = sniper?.total_value || 1000
  const combinedValue = gabValue + clipValue + sniperValue

  const gabPnl = gabagool?.realized_pnl || 0
  const clipPnl = clipper?.realized_pnl || 0
  const sniperPnl = sniper?.realized_pnl || 0
  const combinedPnl = gabPnl + clipPnl + sniperPnl

  const gabTrades = gabagool?.recent_trades?.length || 0
  const clipTrades = clipper?.recent_trades?.filter(t => t.action === 'OPEN_ARB').length || 0
  const sniperTrades = sniper?.orders_placed || 0
  const totalTrades = gabTrades + clipTrades + sniperTrades

  const gabActive = gabagool?.status === 'running'
  const clipActive = clipper?.status === 'running'
  const sniperActive = sniper?.status === 'running'
  const activeBots = (gabActive ? 1 : 0) + (clipActive ? 1 : 0) + (sniperActive ? 1 : 0)

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

  const stats = [
    {
      label: 'Combined Portfolio',
      value: formatCurrency(combinedValue),
      change: combinedValue - 3000,
      changeLabel: 'from $3,000',
    },
    {
      label: 'Realized P&L',
      value: formatPnl(combinedPnl),
      isPnl: true,
      pnlValue: combinedPnl,
    },
    {
      label: 'Total Trades',
      value: totalTrades.toString(),
      subtext: 'All bots combined',
    },
    {
      label: 'Active Bots',
      value: `${activeBots}/3`,
      status: activeBots === 3 ? 'good' : activeBots >= 1 ? 'partial' : 'offline',
    },
  ]

  return (
    <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border`}>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-tv-border">
        {stats.map((stat, index) => (
          <div key={index} className="p-4">
            <div className={`text-xs uppercase tracking-wider mb-1 ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              {stat.label}
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${
              stat.isPnl
                ? stat.pnlValue && stat.pnlValue >= 0 ? 'text-tv-green' : 'text-tv-red'
                : darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'
            }`}>
              {stat.value}
            </div>
            {stat.change !== undefined && (
              <div className={`text-xs mt-1 ${stat.change >= 0 ? 'text-tv-green' : 'text-tv-red'}`}>
                {stat.change >= 0 ? '+' : ''}{formatCurrency(stat.change)} {stat.changeLabel}
              </div>
            )}
            {stat.subtext && (
              <div className={`text-xs mt-1 ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                {stat.subtext}
              </div>
            )}
            {stat.status && (
              <div className={`text-xs mt-1 ${
                stat.status === 'good' ? 'text-tv-green' :
                stat.status === 'partial' ? 'text-tv-yellow' : 'text-tv-red'
              }`}>
                {stat.status === 'good' ? 'All systems operational' :
                 stat.status === 'partial' ? 'Partial operation' : 'Systems offline'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
