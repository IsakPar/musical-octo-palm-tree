import { useEffect, useRef, useCallback } from 'react'
import { useBotStore } from '../stores/useBotStore'
import { useAuthStore } from '../stores/useAuthStore'

const API_URL = import.meta.env.VITE_API_URL || ''

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { token, logout } = useAuthStore()
  const {
    setConnected,
    setGabagoolState,
    setClipperState,
    setSniperState,
    setSynthArbState,
    addTrade,
    addOpportunity,
    addScanActivity,
    setInitialState,
  } = useBotStore()

  const connect = useCallback(() => {
    if (!token) {
      console.log('[WS] No token, skipping connection')
      return
    }

    // Determine WebSocket URL based on environment
    let wsUrl: string
    if (API_URL) {
      // Production: use API_URL
      const apiBase = API_URL.replace(/^http/, 'ws')
      wsUrl = `${apiBase}/ws?token=${encodeURIComponent(token)}`
    } else {
      // Development: use current host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`
    }

    console.log('[WS] Connecting to', wsUrl.replace(token, '***'))

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      setConnected(true)

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping')
        }
      }, 30000)
    }

    ws.onclose = (event) => {
      console.log('[WS] Disconnected', event.code, event.reason)
      setConnected(false)

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }

      // If auth error, logout
      if (event.code === 4001) {
        console.log('[WS] Auth error, logging out')
        logout()
        return
      }

      // Reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[WS] Reconnecting...')
        connect()
      }, 2000)
    }

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'initial_state':
            console.log('[WS] Received initial state')
            setInitialState(message.gabagool, message.clipper, message.sniper, message.synth_arb)
            break

          case 'state_update':
            if (message.bot === 'gabagool') {
              setGabagoolState(message.data || message)
            } else if (message.bot === 'clipper') {
              setClipperState(message.data || message)
            } else if (message.bot === 'sniper') {
              setSniperState(message.data || message)
            } else if (message.bot === 'synth-arb') {
              setSynthArbState(message.data || message)
            }
            break

          case 'trade':
            console.log('[WS] Trade:', message)
            addTrade({
              ...message.data,
              bot: message.bot,
              timestamp: message.timestamp || message.data?.timestamp
            })
            break

          case 'opportunity':
            console.log('[WS] Opportunity:', message)
            addOpportunity(message.data)
            break

          case 'scan_activity':
            if (message.bot === 'sniper') {
              console.log('[WS] Scan Activity:', message)
              addScanActivity(message.data || message)
            }
            break

          default:
            console.log('[WS] Unknown message type:', message.type)
        }
      } catch (e) {
        // Ignore non-JSON messages (like 'pong')
        if (event.data !== 'pong') {
          console.error('[WS] Parse error:', e)
        }
      }
    }
  }, [token, logout, setConnected, setGabagoolState, setClipperState, setSniperState, setSynthArbState, addTrade, addOpportunity, addScanActivity, setInitialState])

  useEffect(() => {
    if (!token) return

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect, token])

  return wsRef.current
}
