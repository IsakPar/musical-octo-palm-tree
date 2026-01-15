import CombinedStats from '../components/CombinedStats'
import BotPanel from '../components/BotPanel'
import TradeFeed from '../components/TradeFeed'
import PortfolioChart from '../components/PortfolioChart'

export default function DashboardPage() {

    return (
        <div>
            {/* Combined Stats */}
            <CombinedStats />

            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-4 mt-4">
                {/* Left Column - Bot Panels */}
                <div className="col-span-12 lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <BotPanel bot="gabagool" />
                        <BotPanel bot="clipper" />
                        <BotPanel bot="sniper" />
                    </div>

                    {/* Portfolio Chart */}
                    <PortfolioChart />
                </div>

                {/* Right Column - Trade Feed */}
                <div className="col-span-12 lg:col-span-4">
                    <TradeFeed />
                </div>
            </div>
        </div>
    )
}
