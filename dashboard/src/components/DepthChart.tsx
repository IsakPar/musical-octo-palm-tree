import { useMemo } from 'react'
import { useBotStore } from '../stores/useBotStore'

interface DepthLevel {
  price: number
  size: number
}

interface DepthChartProps {
  bids: DepthLevel[]
  asks: DepthLevel[]
  midPrice?: number
  tokenLabel?: string // "YES" or "NO"
  height?: number
}

export default function DepthChart({
  bids,
  asks,
  midPrice,
  tokenLabel = '',
  height = 200,
}: DepthChartProps) {
  const { darkMode } = useBotStore()

  // Calculate cumulative sizes and max for scaling
  const { cumulativeBids, cumulativeAsks, maxCumulative } = useMemo(() => {
    // Sort bids descending by price, asks ascending
    const sortedBids = [...bids].sort((a, b) => b.price - a.price)
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price)

    let cumBid = 0
    const cumulativeBids = sortedBids.map(level => {
      cumBid += level.size
      return { ...level, cumulative: cumBid }
    })

    let cumAsk = 0
    const cumulativeAsks = sortedAsks.map(level => {
      cumAsk += level.size
      return { ...level, cumulative: cumAsk }
    })

    const maxCumulative = Math.max(
      cumulativeBids[cumulativeBids.length - 1]?.cumulative || 0,
      cumulativeAsks[cumulativeAsks.length - 1]?.cumulative || 0
    )

    return { cumulativeBids, cumulativeAsks, maxCumulative }
  }, [bids, asks])

  // Calculate VWAP for display
  const vwapBid = useMemo(() => {
    if (bids.length === 0) return null
    const totalValue = bids.reduce((sum, l) => sum + l.price * l.size, 0)
    const totalSize = bids.reduce((sum, l) => sum + l.size, 0)
    return totalSize > 0 ? totalValue / totalSize : null
  }, [bids])

  const vwapAsk = useMemo(() => {
    if (asks.length === 0) return null
    const totalValue = asks.reduce((sum, l) => sum + l.price * l.size, 0)
    const totalSize = asks.reduce((sum, l) => sum + l.size, 0)
    return totalSize > 0 ? totalValue / totalSize : null
  }, [asks])

  const formatPrice = (price: number) => `$${price.toFixed(2)}`
  const formatSize = (size: number) => size.toLocaleString()

  if (bids.length === 0 && asks.length === 0) {
    return (
      <div
        className={`${
          darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'
        } rounded-lg border p-4 flex items-center justify-center`}
        style={{ height }}
      >
        <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
          No order book data
        </span>
      </div>
    )
  }

  return (
    <div
      className={`${
        darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'
      } rounded-lg border overflow-hidden`}
    >
      {/* Header */}
      <div
        className={`px-4 py-2 border-b ${
          darkMode ? 'border-tv-border' : 'border-tv-light-border'
        } flex items-center justify-between`}
      >
        <span className={`text-sm font-medium ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
          {tokenLabel} Order Book Depth
        </span>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-tv-green" />
            <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>Bids</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-tv-red" />
            <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>Asks</span>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex" style={{ height: height - 80 }}>
        {/* Bids (left side) */}
        <div className="flex-1 flex flex-col justify-center px-2 py-1">
          {cumulativeBids.slice(0, 6).map((level, i) => {
            const width = maxCumulative > 0 ? (level.cumulative / maxCumulative) * 100 : 0
            return (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span
                  className={`text-xs tabular-nums w-12 text-right ${
                    darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'
                  }`}
                >
                  {formatPrice(level.price)}
                </span>
                <div className="flex-1 flex justify-end">
                  <div
                    className="h-4 bg-tv-green/30 border-r-2 border-tv-green rounded-l transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span
                  className={`text-xs tabular-nums w-10 ${
                    darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'
                  }`}
                >
                  {formatSize(level.size)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Mid price divider */}
        <div
          className={`w-px ${darkMode ? 'bg-tv-border' : 'bg-tv-light-border'} flex items-center justify-center`}
        >
          {midPrice && (
            <div
              className={`absolute px-2 py-1 text-xs font-medium rounded ${
                darkMode ? 'bg-tv-bg-tertiary text-tv-text-primary' : 'bg-tv-light-bg-tertiary text-tv-light-text-primary'
              }`}
            >
              {formatPrice(midPrice)}
            </div>
          )}
        </div>

        {/* Asks (right side) */}
        <div className="flex-1 flex flex-col justify-center px-2 py-1">
          {cumulativeAsks.slice(0, 6).map((level, i) => {
            const width = maxCumulative > 0 ? (level.cumulative / maxCumulative) * 100 : 0
            return (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span
                  className={`text-xs tabular-nums w-10 text-right ${
                    darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'
                  }`}
                >
                  {formatSize(level.size)}
                </span>
                <div className="flex-1">
                  <div
                    className="h-4 bg-tv-red/30 border-l-2 border-tv-red rounded-r transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span
                  className={`text-xs tabular-nums w-12 ${
                    darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'
                  }`}
                >
                  {formatPrice(level.price)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer with VWAP */}
      <div
        className={`px-4 py-2 border-t ${
          darkMode ? 'border-tv-border bg-tv-bg-tertiary/50' : 'border-tv-light-border bg-tv-light-bg-tertiary/50'
        } flex justify-between text-xs`}
      >
        <div className="flex items-center gap-2">
          <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
            VWAP Bid:
          </span>
          <span className="text-tv-green font-medium tabular-nums">
            {vwapBid ? formatPrice(vwapBid) : '-'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}>
            VWAP Ask:
          </span>
          <span className="text-tv-red font-medium tabular-nums">
            {vwapAsk ? formatPrice(vwapAsk) : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}
