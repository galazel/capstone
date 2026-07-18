import { useEffect, useState } from 'react'
import api from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DollarSign, Users, TrendingUp, AlertCircle } from 'lucide-react'

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

  if (loading) return <div className="p-8">Loading revenue dashboard...</div>

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <DollarSign className="w-8 h-8 text-green-600" />
          <h1 className="text-4xl font-bold">Revenue Dashboard</h1>
        </div>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-3xl font-bold">${mockData.totalMRR.toLocaleString()}</p>
                  <p className="text-xs text-green-600">+12% from last month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Active Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-3xl font-bold">{mockData.activeSubscribers.toLocaleString()}</p>
                  <p className="text-xs text-blue-600">+11.8% growth</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Churn Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-3xl font-bold">{mockData.churnRate}%</p>
                  <p className="text-xs text-orange-600">Monthly churn</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockData.revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscriber Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockData.subscriberGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="subscribers" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockData.paymentMethods.map((method) => (
                <div key={method.method} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold">{method.method}</p>
                    <p className="text-sm text-slate-600">{method.count} transactions</p>
                  </div>
                  <p className="text-lg font-bold text-green-600">${method.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="mt-8 border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <CardTitle>Business Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>• Revenue up 12% MoM - Strong product-market fit</li>
              <li>• Churn at 2.3% - Better than industry average (5%)</li>
              <li>• Conversion rate: 8.2% of free users → Pro</li>
              <li>• Average subscription lifetime: 14.3 months</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
