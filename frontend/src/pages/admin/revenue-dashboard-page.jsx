import { useEffect, useState } from 'react'
import api from '@/services/api'
import { BentoGrid, BentoHeading, BentoStat, BentoTile } from '@/components/commons/bento.jsx'
import { SampleChip, TrendLineChart } from '@/components/charts/rebyu-charts.jsx'
import { DollarSign, Users, TrendingUp, AlertCircle } from "@/components/icons"

export default function RevenueDashboardPage() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/admin/revenue/metrics')
      setMetrics(res.data)
    } catch (err) {
      console.error('Failed to load revenue metrics', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading revenue dashboard...</div>

  const mockData = {
    totalMRR: 15420,
    activeSubscribers: 1543,
    churnRate: 2.3,
    paymentMethods: [
      { method: 'Credit Card', count: 892, revenue: 8940 },
      { method: 'Debit Card', count: 456, revenue: 4560 },
      { method: 'E-Wallet', count: 195, revenue: 1920 },
    ],
    revenueHistory: [
      { month: 'Jan', revenue: 5200 },
      { month: 'Feb', revenue: 7840 },
      { month: 'Mar', revenue: 9120 },
      { month: 'Apr', revenue: 11560 },
      { month: 'May', revenue: 13890 },
      { month: 'Jun', revenue: 15420 },
    ],
    subscriberGrowth: [
      { month: 'Jan', subscribers: 320 },
      { month: 'Feb', subscribers: 580 },
      { month: 'Mar', subscribers: 845 },
      { month: 'Apr', subscribers: 1120 },
      { month: 'May', subscribers: 1380 },
      { month: 'Jun', subscribers: 1543 },
    ],
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-3">
          <DollarSign className="size-8 text-rb-bee-lip" />
          <h1 className="font-rb-display text-4xl font-extrabold tracking-tight">Revenue Dashboard</h1>
        </div>

        {/* Bento — same mosaic as the platform dashboard, mocked data chipped
            "sample data" until /admin/revenue/metrics returns real series. */}
        <BentoGrid className="mb-8">
          <BentoStat
            tone="bee"
            col={2}
            row={1}
            icon={DollarSign}
            label="Total MRR"
            value={`$${mockData.totalMRR.toLocaleString()}`}
            hint="+12% from last month"
          />
          <BentoStat
            tone="macaw"
            col={2}
            row={1}
            icon={Users}
            label="Active Subscribers"
            value={mockData.activeSubscribers.toLocaleString()}
            hint="+11.8% growth"
          />
          <BentoStat
            tone="fox"
            col={2}
            row={1}
            icon={TrendingUp}
            label="Churn Rate"
            value={`${mockData.churnRate}%`}
            hint="Monthly churn"
          />

          <BentoTile col={3} row={2}>
            <BentoHeading title="Revenue growth" hint="Monthly recurring revenue" chip={<SampleChip />} />
            <TrendLineChart
              data={mockData.revenueHistory}
              xKey="month"
              series={[{ key: "revenue", name: "Revenue" }]}
              domain={[0, 18000]}
              height={220}
              legendNote="Latest month"
            />
          </BentoTile>
          <BentoTile col={3} row={2}>
            <BentoHeading title="Subscriber growth" hint="Active subscribers per month" chip={<SampleChip />} />
            <TrendLineChart
              data={mockData.subscriberGrowth}
              xKey="month"
              series={[{ key: "subscribers", name: "Subscribers" }]}
              domain={[0, 1700]}
              height={220}
              legendNote="Latest month"
            />
          </BentoTile>

          <BentoTile col={4} row={1} className="!p-0">
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <BentoHeading title="Payment methods" />
              <div className="grid gap-3 sm:grid-cols-3">
                {mockData.paymentMethods.map((method) => (
                  <div key={method.method} className="rounded-xl border-2 border-border bg-background p-3">
                    <p className="font-bold">{method.method}</p>
                    <p className="text-xs text-muted-foreground">{method.count} transactions</p>
                    <p className="mt-1 text-lg font-extrabold text-rb-bee-lip">
                      ${method.revenue.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </BentoTile>

          <BentoTile tone="fox" col={2} row={1}>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 shrink-0" />
              <h3 className="font-rb-display text-sm font-extrabold lowercase">business insights</h3>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs font-semibold">
              <li>Revenue up 12% MoM — strong product-market fit</li>
              <li>Churn at 2.3% — better than industry average (5%)</li>
              <li>Conversion rate: 8.2% of free users → Pro</li>
              <li>Average subscription lifetime: 14.3 months</li>
            </ul>
          </BentoTile>
        </BentoGrid>
      </div>
    </div>
  )
}
