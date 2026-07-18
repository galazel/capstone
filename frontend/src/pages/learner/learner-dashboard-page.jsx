import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Coins, BookOpen, TrendingUp, CheckCircle2, Clock,
  ArrowRight, Trophy, Award, Flame
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/services/api'

export default function LearnerDashboardPage() {
  const navigate = useNavigate()
  const [portalData, setPortalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/learners/me/portal')
      setPortalData(response.data)
      setError(null)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError('Could not load your dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchDashboardData} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const learner = portalData?.learner || {}
  const certs = portalData?.learnerCertifications || []
  const activityLogs = portalData?.activityLogs || []
  const completedLessons = portalData?.completedLessons || []
  const totalXp = portalData?.totalXp || 0
  const coinBalance = portalData?.coinBalance || 0
  const aiCredits = portalData?.aiCreditsRemaining || 0

  const activeEnrollments = certs.filter(c => c.status !== 'COMPLETED').length
  const completedEnrollments = certs.filter(c => c.status === 'COMPLETED').length

  const getProgressColor = (progress) => {
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-blue-500'
    if (progress >= 50) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const getMasteryLevel = (level) => {
    const levels = ['Not Started', 'Familiarity', 'Beginning', 'Intermediate', 'Mastery']
    return levels[level] || 'Unknown'
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Welcome back, {learner.firstName || 'Learner'}!</h1>
          <p className="text-muted-foreground">Keep up your learning momentum</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total XP</p>
                  <p className="text-2xl font-bold">{totalXp.toLocaleString()}</p>
                </div>
                <Zap className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Coins</p>
                  <p className="text-2xl font-bold">{coinBalance}</p>
                </div>
                <Coins className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Credits</p>
                  <p className="text-2xl font-bold">{aiCredits}</p>
                </div>
                <Zap className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedEnrollments}</p>
                </div>
                <Trophy className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Enrollments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Your Certifications ({activeEnrollments} in progress)</h2>
            <Button variant="outline" onClick={() => navigate('/learner/certifications')}>
              View All
            </Button>
          </div>

          {certs.length === 0 ? (
            <Card>
              <CardContent className="pt-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No certifications yet</p>
                <Button onClick={() => navigate('/learner/certifications')}>
                  Browse Certifications
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {certs.slice(0, 6).map((cert) => (
                <Card
                  key={cert.learnerCertificationId}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/learner/certifications/${cert.learnerCertificationId}`)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{cert.certificationName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span className="font-semibold">{Math.round(cert.progressPercentage || 0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getProgressColor(cert.progressPercentage || 0)}`}
                          style={{ width: `${Math.min(cert.progressPercentage || 0, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className="text-sm font-semibold">
                        {cert.status === 'COMPLETED' ? '✓ Completed' : cert.status || 'In Progress'}
                      </span>
                    </div>

                    {/* BKT Mastery (if available) */}
                    {cert.masteryLevel !== undefined && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Mastery</span>
                        <span className="text-sm font-semibold">{getMasteryLevel(cert.masteryLevel)}</span>
                      </div>
                    )}

                    {cert.status !== 'COMPLETED' && (
                      <Button size="sm" className="w-full" variant="outline">
                        Continue Learning
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
          {activityLogs.length === 0 ? (
            <Card>
              <CardContent className="pt-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activityLogs.slice(0, 5).map((log, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{log.actionType}</p>
                        <p className="text-sm text-muted-foreground">{log.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              size="lg"
              className="h-auto py-6"
              onClick={() => navigate('/learner/practice')}
            >
              <div className="text-center">
                <Flame className="w-6 h-6 mx-auto mb-2" />
                <p>Practice</p>
              </div>
            </Button>
            <Button
              size="lg"
              className="h-auto py-6"
              onClick={() => navigate('/learner/community')}
            >
              <div className="text-center">
                <Award className="w-6 h-6 mx-auto mb-2" />
                <p>Community</p>
              </div>
            </Button>
            <Button
              size="lg"
              className="h-auto py-6"
              onClick={() => navigate('/learner/rankings')}
            >
              <div className="text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                <p>Rankings</p>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
