import { useEffect, useState } from 'react'
import api from '@/services/api'
import { StreakWidget } from '@/components/learner/streak-widget'
import { MasteryIndicator } from '@/components/learner/mastery-indicator'
import { BentoGrid, BentoHeading, BentoStat, BentoTile } from '@/components/commons/bento.jsx'
import { BookOpen, Trophy, Zap, TrendingUp, Coins, Bell } from "@/components/icons"

const QUICK_ACTIONS = [
  { href: "/study-plans", label: "Study Plans", icon: BookOpen, tone: "feather" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, tone: "fox" },
  { href: "/subscription", label: "Go Pro", icon: Zap, tone: "beetle" },
  { href: "/settings/notifications", label: "Reminders", icon: Bell, tone: "bee" },
]

const ACTION_TONE_CLASSES = {
  feather: "border-rb-feather/30 bg-rb-feather-wash text-rb-feather-lip dark:bg-[#152744]",
  fox: "border-rb-fox/30 bg-rb-fox-wash text-rb-fox-lip dark:bg-[#3a2a12]",
  beetle: "border-rb-beetle/30 bg-rb-beetle-wash text-rb-beetle-lip dark:bg-[#2a1f3a]",
  bee: "border-rb-bee/30 bg-rb-bee-wash text-rb-bee-lip dark:bg-[#12333a]",
}

const MASTERY_BAR_TONE = ['bg-muted-foreground/40', 'bg-rb-fox', 'bg-rb-beetle', 'bg-rb-feather', 'bg-rb-bee']

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

  if (loading) return <div className="p-8 text-muted-foreground">Loading dashboard...</div>

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="font-rb-display text-4xl font-extrabold tracking-tight">Welcome back! 👋</h1>
          <p className="mt-1 text-muted-foreground">Here's your learning progress at a glance</p>
        </div>

        <BentoGrid className="mb-8">
          {/* Band 1 — 3 + 3 */}
          <BentoStat tone="feather" col={3} row={1} icon={TrendingUp} label="Total XP" value={portal?.totalXp || 0} />
          <BentoStat tone="fox" col={3} row={1} icon={Coins} label="Coins" value={portal?.coinBalance || 0} />

          {/* Band 2 — 3 + 3 */}
          <BentoStat tone="bee" col={3} row={1} icon={Trophy} label="Completed" value={portal?.completedCount || 0} />
          <BentoStat
            tone="beetle"
            col={3}
            row={1}
            icon={Zap}
            label="AI Credits"
            value={portal?.aiCreditsRemaining || 0}
          />
        </BentoGrid>

        <div className="mb-8">
          <StreakWidget />
        </div>

        {/* Certifications */}
        {portal?.certifications && portal.certifications.length > 0 && (
          <BentoTile tone="plain" col={6} row={1} className="mb-8 !p-6">
            <BentoHeading title="Learning Certifications" />
            <div className="grid gap-4 md:grid-cols-2">
              {portal.certifications.map((cert) => {
                const masteryLevel = portal.masteryByMasteryByCertification?.[cert.certId] || 0
                const progress = Math.min((masteryLevel / 4) * 100, 100)

                return (
                  <section key={cert.certId} className="rounded-rb-card border-2 border-border bg-card p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{cert.name}</h3>
                        <p className="text-sm text-muted-foreground">{cert.description}</p>
                      </div>
                      <MasteryIndicator level={masteryLevel} size="sm" />
                    </div>

                    <div className="mb-2 h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${MASTERY_BAR_TONE[Math.min(masteryLevel, 4)]}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{progress.toFixed(0)}% towards mastery</p>
                  </section>
                )
              })}
            </div>
          </BentoTile>
        )}

        {/* Quick Actions */}
        <BentoTile tone="plain" col={6} row={1} className="!p-6">
          <BentoHeading title="Quick Actions" />
          <div className="grid gap-4 md:grid-cols-4">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon, tone }) => (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 transition hover:brightness-95 ${ACTION_TONE_CLASSES[tone]}`}
              >
                <Icon className="size-6" />
                <span className="font-semibold">{label}</span>
              </a>
            ))}
          </div>
        </BentoTile>
      </div>
    </div>
  )
}
