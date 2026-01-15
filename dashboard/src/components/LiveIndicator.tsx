import { useBotStore } from '../stores/useBotStore'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

interface LiveIndicatorProps {
  status: 'connected' | 'connecting' | 'disconnected'
  lastUpdate?: Date | string | null
  label?: string
}

export default function LiveIndicator({
  status,
  lastUpdate,
  label = 'Live',
}: LiveIndicatorProps) {
  const { darkMode } = useBotStore()

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-tv-green'
      case 'connecting':
        return 'bg-tv-yellow'
      case 'disconnected':
        return 'bg-tv-red'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className="w-3 h-3" />
      case 'connecting':
        return <Loader2 className="w-3 h-3 animate-spin" />
      case 'disconnected':
        return <WifiOff className="w-3 h-3" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return label
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Disconnected'
    }
  }

  const formatLastUpdate = () => {
    if (!lastUpdate) return null
    const date = typeof lastUpdate === 'string' ? new Date(lastUpdate) : lastUpdate
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 5) return 'just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return date.toLocaleTimeString()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Pulsing dot */}
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        {status === 'connected' && (
          <div
            className={`absolute inset-0 w-2 h-2 rounded-full ${getStatusColor()} animate-ping opacity-75`}
          />
        )}
      </div>

      {/* Status text */}
      <div className="flex items-center gap-1.5">
        <span
          className={`text-xs font-medium ${
            status === 'connected'
              ? 'text-tv-green'
              : status === 'connecting'
              ? 'text-tv-yellow'
              : 'text-tv-red'
          }`}
        >
          {getStatusText()}
        </span>
        {getStatusIcon()}
      </div>

      {/* Last update tooltip */}
      {lastUpdate && status === 'connected' && (
        <span
          className={`text-xs ${
            darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'
          }`}
        >
          ({formatLastUpdate()})
        </span>
      )}
    </div>
  )
}
