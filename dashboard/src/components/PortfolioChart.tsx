import { useEffect, useRef } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts'
import { useBotStore } from '../stores/useBotStore'

export default function PortfolioChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const gabagoolSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const clipperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const { gabagool, clipper, darkMode } = useBotStore()

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: darkMode ? '#1e222d' : '#f0f3fa',
        },
        textColor: darkMode ? '#d1d4dc' : '#131722',
      },
      grid: {
        vertLines: {
          color: darkMode ? '#363a45' : '#e0e3eb',
        },
        horzLines: {
          color: darkMode ? '#363a45' : '#e0e3eb',
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: darkMode ? '#363a45' : '#e0e3eb',
      },
      rightPriceScale: {
        borderColor: darkMode ? '#363a45' : '#e0e3eb',
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: darkMode ? '#758696' : '#9598a1',
          width: 1,
          style: 2,
          labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb',
        },
        horzLine: {
          color: darkMode ? '#758696' : '#9598a1',
          width: 1,
          style: 2,
          labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb',
        },
      },
    })

    chartRef.current = chart

    // Gabagool series (red)
    const gabagoolSeries = chart.addLineSeries({
      color: '#ef5350',
      lineWidth: 2,
      title: 'Gabagool',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    })
    gabagoolSeriesRef.current = gabagoolSeries

    // Clipper series (green)
    const clipperSeries = chart.addLineSeries({
      color: '#26a69a',
      lineWidth: 2,
      title: 'Clipper',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    })
    clipperSeriesRef.current = clipperSeries

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

  // Update chart colors when theme changes
  useEffect(() => {
    if (!chartRef.current) return

    chartRef.current.applyOptions({
      layout: {
        background: {
          type: ColorType.Solid,
          color: darkMode ? '#1e222d' : '#f0f3fa',
        },
        textColor: darkMode ? '#d1d4dc' : '#131722',
      },
      grid: {
        vertLines: {
          color: darkMode ? '#363a45' : '#e0e3eb',
        },
        horzLines: {
          color: darkMode ? '#363a45' : '#e0e3eb',
        },
      },
      timeScale: {
        borderColor: darkMode ? '#363a45' : '#e0e3eb',
      },
      rightPriceScale: {
        borderColor: darkMode ? '#363a45' : '#e0e3eb',
      },
    })
  }, [darkMode])

  // Update data when portfolio history changes
  useEffect(() => {
    if (!gabagoolSeriesRef.current || !clipperSeriesRef.current) return

    const convertToLineData = (history: Array<{ timestamp: string; total_value: number }> | undefined): LineData[] => {
      if (!history || history.length === 0) return []

      return history
        .map(item => ({
          time: (new Date(item.timestamp).getTime() / 1000) as Time,
          value: item.total_value,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number))
    }

    const gabagoolData = convertToLineData(gabagool?.portfolio_history)
    const clipperData = convertToLineData(clipper?.portfolio_history)

    if (gabagoolData.length > 0) {
      gabagoolSeriesRef.current.setData(gabagoolData)
    }

    if (clipperData.length > 0) {
      clipperSeriesRef.current.setData(clipperData)
    }

    // Fit content to show all data
    if (chartRef.current && (gabagoolData.length > 0 || clipperData.length > 0)) {
      chartRef.current.timeScale().fitContent()
    }
  }, [gabagool?.portfolio_history, clipper?.portfolio_history])

  return (
    <div className={`${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'} rounded-lg border overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-tv-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <h2 className={`font-semibold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
            Portfolio Performance
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-tv-red rounded" />
            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              Gabagool
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-tv-green rounded" />
            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
              Clipper
            </span>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  )
}
