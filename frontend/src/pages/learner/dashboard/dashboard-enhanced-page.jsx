import { useEffect, useState } from 'react'
import api from '@/services/api'
import { StreakWidget } from '@/components/learner/streak-widget'
import { MasteryIndicator } from '@/components/learner/mastery-indicator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Trophy, Zap, TrendingUp } from 'lucide-react'

export default function DashboardEnhancedPage() {
  const [portal, setPortal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPortalData()
  }, [])

  const fetchPortalData = async () => {
    try {
      const res = await api.get('/learners/me/portal')
      setPortal(res.data)
    } catch (err) {
      console.error('Failed to load portal', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8">Loading dashboard...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome back! 👋</h1>
          <p className="text-slate-600">Here's your learning progress at a glance</p>
        </div>

        {/* Gamification Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total XP</p>
                  <p className="text-2xl font-bold text-blue-600">{portal?.totalXp || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Coins</p>
                  <p className="text-2xl font-bold text-yellow-600">{portal?.coinBalance || 0}</p>
                </div>
                <span className="text-2xl">🪙</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">AI Credits</p>
                  <p className="text-2xl font-bold text-purple-600">{portal?.aiCreditsRemaining || 0}</p>
                </div>
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{portal?.completedCount || 0}</p>
                </div>
                <Trophy className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streak Widget */}
        <div className="mb-8">
          <StreakWidget />
        </div>

        {/* Certifications */}
        {portal?.certifications && portal.certifications.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Learning Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {portal.certifications.map((cert) => {
                  const masteryLevel = portal.masteryByMasteryByCertification?.[cert.certId] || 0
                  const progress = Math.min((masteryLevel / 4) * 100, 100)

                  return (
                    <Card key={cert.certId} className="border-slate-200">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold">{cert.name}</h3>
                            <p className="text-sm text-slate-600">{cert.description}</p>
                          </div>
                          <MasteryIndicator level={masteryLevel} size="sm" />
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              masteryLevel === 0
                                ? 'bg-gray-300'
                                : masteryLevel === 1
                                  ? 'bg-yellow-400'
                                  : masteryLevel === 2
                                    ? 'bg-orange-400'
                                    : masteryLevel === 3
                                      ? 'bg-blue-400'
                                      : 'bg-green-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          {progress.toFixed(0)}% towards mastery
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <a
                href="/study-plans"
                className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
              >
                <BookOpen className="w-6 h-6 text-blue-600" />
                <span className="font-medium text-blue-900">Study Plans</span>
              </a>
              <a
                href="/leaderboard"
                className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition"
              >
                <Trophy className="w-6 h-6 text-yellow-600" />
                <span className="font-medium text-yellow-900">Leaderboard</span>
              </a>
              <a
                href="/subscription"
                className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
              >
                <Zap className="w-6 h-6 text-purple-600" />
                <span className="font-medium text-purple-900">Go Pro</span>
              </a>
              <a
                href="/settings/notifications"
                className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition"
              >
                <span className="text-2xl">🔔</span>
                <span className="font-medium text-green-900">Reminders</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
