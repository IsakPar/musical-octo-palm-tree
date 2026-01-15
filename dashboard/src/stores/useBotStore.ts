import { create } from 'zustand'

// Types
interface Position {
  id?: string
  arb_id?: string
  timestamp: string
  market_slug: string
  asset?: string
  outcome?: string
  question?: string
  entry_price?: number
  yes_price?: number
  no_price?: number
  quantity?: number
  yes_shares?: number
  no_shares?: number
  total_cost?: number
  expected_pnl?: number
  arb_pct?: number
  status: string
  pnl?: number
  actual_pnl?: number
}

interface Trade {
  timestamp: string
  market_slug: string
  asset?: string
  outcome?: string
  side?: string
  action?: string
  price?: number
  yes_price?: number
  no_price?: number
  quantity?: number
  value?: number
  total_cost?: number
  pnl: number
  expected_pnl?: number
  actual_pnl?: number
  arb_pct?: number
  reason?: string
  bot?: string
}

interface Opportunity {
  timestamp: string
  market_slug: string
  question: string
  yes_ask: number
  no_ask: number
  total: number
  arb_pct: number
  yes_liquidity: number
  no_liquidity: number
  action: string
}

interface PortfolioSnapshot {
  timestamp: string
  total_value: number
  realized_pnl: number
}

interface ScanActivity {
  scan_number: number
  leagues_checked: string[]
  games_found: Array<{
    game_id: string
    matchup: string
    winner: string
    margin: number
    league: string
  }>
  markets_searched: number
  opportunities_evaluated: Array<{
    market_slug: string
    question: string
    game: string
    confidence: number
    current_price: number
    decision: 'TAKEN' | 'SKIPPED'
    skip_reason: string | null
  }>
  opportunities_taken: number
  opportunities_skipped: number
  timestamp?: string
}

interface SniperPosition {
  id: string
  market: string
  game: string
  winner: string
  bid_price: number
  filled: number
  expected_profit: number
  status: string
}

interface BotState {
  status: 'running' | 'stopped' | 'error'
  cash: number
  positions_value?: number
  locked_in_arbs?: number
  total_exposure?: number
  total_value: number
  realized_pnl: number
  open_positions: Position[]
  recent_trades: Trade[]
  recent_opportunities?: Opportunity[]
  scan_count: number
  markets_scanned: number
  games_checked?: number
  opportunities_found?: number
  orders_placed?: number
  active_snipes?: number
  active_positions?: SniperPosition[]
  recent_snipes?: Array<{id: string, market: string, filled: number, profit: number, status: string}>
  portfolio_history: PortfolioSnapshot[]
  open_arbs?: number
}

// Synth-Arb specific types
interface SynthArbPosition {
  condition_id: string
  entry_price: number
  size: number
  side: 'Long' | 'Short'
  entry_time: string
  unrealized_pnl: number
  market_value: number
}

interface SynthArbMetrics {
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown: string
  max_drawdown_pct: number
  current_drawdown: string
  current_drawdown_pct: number
  win_rate: number
  profit_factor: number
  avg_win: string
  avg_loss: string
  largest_win: string
  largest_loss: string
  expectancy: string
  consecutive_wins: number
  consecutive_losses: number
  max_consecutive_wins: number
  max_consecutive_losses: number
  trades_today: number
  pnl_today: string
}

interface SynthArbState {
  status: 'running' | 'disconnected' | 'stopped'
  cash: number
  total_value: number
  realized_pnl: number
  total_exposure: number
  open_positions: SynthArbPosition[]
  trades_count: number
  wins: number
  losses: number
  win_rate: number
  markets_count: number
  messages_received: number
  metrics?: SynthArbMetrics
}

interface Store {
  // Connection state
  connected: boolean
  setConnected: (connected: boolean) => void

  // Theme
  darkMode: boolean
  toggleTheme: () => void

  // Bot states
  gabagool: BotState | null
  clipper: BotState | null
  sniper: BotState | null
  synthArb: SynthArbState | null

  // Live trade feed (combined)
  tradeFeed: Trade[]

  // Sniper scan history for visibility
  sniperScanHistory: ScanActivity[]

  // Actions
  setGabagoolState: (state: BotState) => void
  setClipperState: (state: BotState) => void
  setSniperState: (state: BotState) => void
  setSynthArbState: (state: SynthArbState) => void
  addTrade: (trade: Trade & { bot: string }) => void
  addOpportunity: (opportunity: Opportunity) => void
  addScanActivity: (activity: ScanActivity) => void
  setInitialState: (gabagool: BotState, clipper: BotState, sniper?: BotState, synthArb?: SynthArbState) => void
}

const defaultBotState: BotState = {
  status: 'stopped',
  cash: 1000,
  total_value: 1000,
  realized_pnl: 0,
  open_positions: [],
  recent_trades: [],
  scan_count: 0,
  markets_scanned: 0,
  portfolio_history: [],
}

export const useBotStore = create<Store>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),

  darkMode: true,
  toggleTheme: () => set((state) => {
    const newDarkMode = !state.darkMode
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
    return { darkMode: newDarkMode }
  }),

  gabagool: defaultBotState,
  clipper: defaultBotState,
  sniper: defaultBotState,
  synthArb: null,
  tradeFeed: [],
  sniperScanHistory: [],

  setGabagoolState: (state) => set({ gabagool: state }),
  setClipperState: (state) => set({ clipper: state }),
  setSniperState: (state) => set({ sniper: state }),
  setSynthArbState: (state) => set({ synthArb: state }),

  addTrade: (trade) => set((state) => ({
    tradeFeed: [trade, ...state.tradeFeed].slice(0, 100)
  })),

  addOpportunity: (opportunity) => set((state) => {
    if (!state.clipper) return {}
    return {
      clipper: {
        ...state.clipper,
        recent_opportunities: [opportunity, ...(state.clipper.recent_opportunities || [])].slice(0, 50)
      }
    }
  }),

  addScanActivity: (activity) => set((state) => ({
    sniperScanHistory: [
      { ...activity, timestamp: new Date().toISOString() },
      ...state.sniperScanHistory
    ].slice(0, 50)
  })),

  setInitialState: (gabagool, clipper, sniper, synthArb) => set({
    gabagool: gabagool || defaultBotState,
    clipper: clipper || defaultBotState,
    sniper: sniper || defaultBotState,
    synthArb: synthArb || null,
  }),
}))
