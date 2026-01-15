import { useBotStore } from '../stores/useBotStore'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number      // Percentage change
  changeLabel?: string // "today", "24h", etc.
  icon?: React.ReactNode
  variant?: 'default' | 'profit' | 'loss'
  prefix?: string      // e.g., "$"
  suffix?: string      // e.g., "%"
}

export default function MetricCard({
  title,
  value,
  change,
  changeLabel = 'today',
  icon,
  variant = 'default',
  prefix = '',
  suffix = '',
}: MetricCardProps) {
  const { darkMode } = useBotStore()

  const getVariantStyles = () => {
    switch (variant) {
      case 'profit':
        return 'text-tv-green'
      case 'loss':
        return 'text-tv-red'
      default:
        return darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'
    }
  }

  const getChangeColor = () => {
    if (change === undefined || change === 0) return darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'
    return change > 0 ? 'text-tv-green' : 'text-tv-red'
  }

  const getChangeIcon = () => {
    if (change === undefined || change === 0) return <Minus className="w-3 h-3" />
    return change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
  }

  const formatChange = () => {
    if (change === undefined) return null
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(2)}%`
  }

  return (
    <div
      className={`${
        darkMode
          ? 'bg-tv-bg-secondary border-tv-border'
          : 'bg-tv-light-bg-secondary border-tv-light-border'
      } rounded-lg border p-4 transition-all hover:border-tv-blue/50`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-xs uppercase tracking-wider ${
            darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'
          }`}
        >
          {title}
        </span>
        {icon && (
          <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
            {icon}
          </span>
        )}
      </div>

      {/* Value */}
      <div className={`text-2xl font-semibold tabular-nums ${getVariantStyles()}`}>
        {prefix}
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix}
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${getChangeColor()}`}>
          {getChangeIcon()}
          <span className="tabular-nums">{formatChange()}</span>
          <span className={darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}>
            {changeLabel}
          </span>
        </div>
      )}
    </div>
  )
}
