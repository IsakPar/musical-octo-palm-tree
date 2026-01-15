import { useEffect, useRef } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts'
import { useBotStore } from '../stores/useBotStore'
import { Pause, Play } from 'lucide-react'

interface StrategyCardProps {
  name: string
  description: string
  isActive: boolean
  todayPnl: number
  totalPnl: number
  trades: number
  winRate: number
  pnlHistory?: Array<{ timestamp: string; value: number }>
  onToggle?: () => void
}

export default function StrategyCard({
  name,
  description,
  isActive,
  todayPnl,
  totalPnl,
  trades,
  winRate,
  pnlHistory,
  onToggle,
}: StrategyCardProps) {
  const { darkMode } = useBotStore()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  // Initialize mini chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      width: chartContainerRef.current.clientWidth,
      height: 60,
      handleScale: false,
      handleScroll: false,
      timeScale: {
        visible: false,
      },
      rightPriceScale: {
        visible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      crosshair: {
        mode: 0,
      },
    })

    chartRef.current = chart

    const isPositive = (pnlHistory?.length ?? 0) > 0
      ? (pnlHistory![pnlHistory!.length - 1]?.value ?? 0) >= (pnlHistory![0]?.value ?? 0)
      : totalPnl >= 0

    const series = chart.addAreaSeries({
      lineColor: isPositive ? '#26a69a' : '#ef5350',
      topColor: isPositive ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
      bottomColor: isPositive ? 'rgba(38, 166, 154, 0.05)' : 'rgba(239, 83, 80, 0.05)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    seriesRef.current = series

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Update chart data
  useEffect(() => {
    if (!seriesRef.current || !pnlHistory || pnlHistory.length === 0) return

    const data: LineData[] = pnlHistory
      .map(item => ({
        time: (new Date(item.timestamp).getTime() / 1000) as Time,
        value: item.value,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number))

    seriesRef.current.setData(data)
    chartRef.current?.timeScale().fitContent()
  }, [pnlHistory])

  const formatPnl = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}$${Math.abs(value).toFixed(2)}`
  }

  const getPnlColor = (value: number) => {
    if (value > 0) return 'text-tv-green'
    if (value < 0) return 'text-tv-red'
    return darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'
  }

  return (
    <div
      className={`${
        darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'
      } rounded-lg border overflow-hidden transition-all hover:border-tv-blue/50`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b ${
          darkMode ? 'border-tv-border' : 'border-tv-light-border'
        } flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-tv-green' : 'bg-tv-text-tertiary'}`} />
            {isActive && (
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-tv-green animate-ping opacity-75" />
            )}
          </div>

          <div>
            <h3 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
              {name}
            </h3>
            <p className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              {description}
            </p>
          </div>
        </div>

        {/* Toggle button */}
        {onToggle && (
          <button
            onClick={onToggle}
            className={`p-1.5 rounded transition-colors ${
              isActive
                ? 'bg-tv-green/20 text-tv-green hover:bg-tv-green/30'
                : darkMode
                ? 'bg-tv-bg-tertiary text-tv-text-secondary hover:text-tv-text-primary'
                : 'bg-tv-light-bg-tertiary text-tv-light-text-secondary hover:text-tv-light-text-primary'
            }`}
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Mini chart */}
      <div ref={chartContainerRef} className="w-full" />

      {/* Stats */}
      <div className={`px-4 py-3 grid grid-cols-4 gap-2 border-t ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
        <div>
          <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
            Today
          </div>
          <div className={`text-sm font-medium tabular-nums ${getPnlColor(todayPnl)}`}>
            {formatPnl(todayPnl)}
          </div>
        </div>
        <div>
          <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
            Total
          </div>
          <div className={`text-sm font-medium tabular-nums ${getPnlColor(totalPnl)}`}>
            {formatPnl(totalPnl)}
          </div>
        </div>
        <div>
          <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
            Trades
          </div>
          <div className={`text-sm font-medium tabular-nums ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
            {trades}
          </div>
        </div>
        <div>
          <div className={`text-xs ${darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
            Win Rate
          </div>
          <div className={`text-sm font-medium tabular-nums ${winRate >= 50 ? 'text-tv-green' : 'text-tv-red'}`}>
            {winRate.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
