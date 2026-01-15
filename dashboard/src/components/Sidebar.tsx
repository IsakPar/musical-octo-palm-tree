import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useBotStore } from '../stores/useBotStore'

interface NavItem {
    path: string
    label: string
    icon: React.ReactNode
    badge?: number
}

export default function Sidebar() {
    const [isOpen, setIsOpen] = useState(true)
    const { darkMode, gabagool, clipper, sniper, synthArb } = useBotStore()
    const location = useLocation()

    const navItems: NavItem[] = [
        {
            path: '/',
            label: 'Dashboard',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
        },
        {
            path: '/analytics',
            label: 'Analytics',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            path: '/gabagool',
            label: 'Gabagool',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
            ),
            badge: gabagool?.open_positions?.length || 0,
        },
        {
            path: '/clipper',
            label: 'Clipper',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
            ),
            badge: clipper?.open_arbs || 0,
        },
        {
            path: '/sniper',
            label: 'Sniper',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            ),
            badge: sniper?.active_snipes || 0,
        },
        {
            path: '/synth-arb',
            label: 'Synth-Arb',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
            badge: synthArb?.open_positions?.length || 0,
        },
        {
            path: '/scanner',
            label: 'Market Scanner',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            ),
        },
        {
            path: '/decisions',
            label: 'Decision Log',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            ),
        },
        {
            path: '/logs',
            label: 'Activity Log',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
            ),
        },
    ]

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Toggle button (visible when collapsed) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed top-4 left-4 z-50 p-2 rounded-lg transition-all ${darkMode
                    ? 'bg-tv-bg-secondary hover:bg-tv-bg-hover text-tv-text-secondary'
                    : 'bg-tv-light-bg-secondary hover:bg-tv-light-bg-tertiary text-tv-light-text-secondary'
                    } ${isOpen ? 'lg:hidden' : ''}`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    } lg:translate-x-0 ${darkMode ? 'bg-tv-bg-secondary border-tv-border' : 'bg-tv-light-bg-secondary border-tv-light-border'
                    } border-r w-64`}
            >
                {/* Logo */}
                <div className={`flex items-center gap-3 p-4 border-b ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tv-blue to-tv-purple flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className={`font-bold ${darkMode ? 'text-tv-text-primary' : 'text-tv-light-text-primary'}`}>
                            Poly Bots
                        </h1>
                        <p className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>
                            Trading Dashboard
                        </p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => window.innerWidth < 1024 && setIsOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                                    ? darkMode
                                        ? 'bg-tv-blue/10 text-tv-blue'
                                        : 'bg-tv-blue/10 text-tv-blue'
                                    : darkMode
                                        ? 'text-tv-text-secondary hover:bg-tv-bg-hover hover:text-tv-text-primary'
                                        : 'text-tv-light-text-secondary hover:bg-tv-light-bg-tertiary hover:text-tv-light-text-primary'
                                    }`}
                            >
                                {item.icon}
                                <span className="font-medium">{item.label}</span>
                                {item.badge !== undefined && item.badge > 0 && (
                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-tv-blue/20 text-tv-blue' : 'bg-tv-blue/20 text-tv-blue'
                                        }`}>
                                        {item.badge}
                                    </span>
                                )}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* Bot Status Footer */}
                <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${darkMode ? 'border-tv-border' : 'border-tv-light-border'}`}>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Gabagool</span>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${gabagool?.status === 'running' ? 'bg-tv-green pulse-dot' : 'bg-tv-text-tertiary'}`} />
                                <span className={`text-xs ${gabagool?.status === 'running' ? 'text-tv-green' : darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                    {gabagool?.status || 'stopped'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Clipper</span>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${clipper?.status === 'running' ? 'bg-tv-green pulse-dot' : 'bg-tv-text-tertiary'}`} />
                                <span className={`text-xs ${clipper?.status === 'running' ? 'text-tv-green' : darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                    {clipper?.status || 'stopped'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Sniper</span>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${sniper?.status === 'running' ? 'bg-tv-green pulse-dot' : 'bg-tv-text-tertiary'}`} />
                                <span className={`text-xs ${sniper?.status === 'running' ? 'text-tv-green' : darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                    {sniper?.status || 'stopped'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-xs ${darkMode ? 'text-tv-text-secondary' : 'text-tv-light-text-secondary'}`}>Synth-Arb</span>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${synthArb?.status === 'running' ? 'bg-tv-purple pulse-dot' : 'bg-tv-text-tertiary'}`} />
                                <span className={`text-xs ${synthArb?.status === 'running' ? 'text-tv-purple' : darkMode ? 'text-tv-text-tertiary' : 'text-tv-light-text-secondary'}`}>
                                    {synthArb?.status || 'stopped'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    )
}
