import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Coins, BookOpen, Clock, Trophy
} from "@/components/icons"
import { Button } from '@/components/ui/button'
import { getLearnerPortalScoped } from '@/services/learnerService'
import {
  LearnerEmptyState,
  LearnerLoadingSkeleton,
  ProgressBar,
} from '@/components/learner/learner-ui.jsx'
import { BentoGrid, BentoHeading, BentoStat, BentoTile } from '@/components/commons/bento.jsx'
import {
  BarBreakdownChart,
  DonutChart,
  SampleChip,
  Sparkline,
  TrendAreaChart,
  TrendLineChart,
} from '@/components/charts/rebyu-charts.jsx'
import {
  LEARNER_ANSWER_MIX,
  LEARNER_DOMAIN_MASTERY,
  LEARNER_STUDY_MIX,
  LEARNER_XP_TREND,
} from '@/components/charts/sample-data.js'

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
      const data = await getLearnerPortalScoped()
      setPortalData(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError('Could not load your dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LearnerLoadingSkeleton />

  if (error) {
    return (
      <div className="rounded-rb-card border-2 border-rb-cardinal/40 bg-rb-cardinal-wash p-6">
        <p className="font-rb-display font-extrabold lowercase text-rb-cardinal-lip">
          {error}
        </p>
        <Button onClick={fetchDashboardData} className="mt-4 rounded-full" variant="outline">
          Try Again
        </Button>
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

  const getMasteryLevel = (level) => {
    const levels = ['Not Started', 'Familiarity', 'Beginning', 'Intermediate', 'Mastery']
    return levels[level] || 'Unknown'
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-rb-display text-3xl font-extrabold lowercase tracking-tight sm:text-4xl">
          welcome back, {learner.firstName || 'Learner'}
        </h1>
        <p className="mt-2 text-muted-foreground">Keep up your learning momentum</p>
      </header>

      {/* Bento: the tile that matters most is the biggest one, and the counters
          are colour-blocked so the eye lands on them before it reads a word.
          Chart panels are fed from components/charts/sample-data.js and chipped
          "sample data" — swap each for its named endpoint. */}
      <BentoGrid>
        <BentoStat
          tone="fox"
          col={2}
          row={2}
          icon={Zap}
          label="Total XP"
          value={totalXp.toLocaleString()}
          hint="Earned across every activity"
        >
          <div className="mt-4">
            <Sparkline data={LEARNER_XP_TREND} dataKey="xp" />
          </div>
        </BentoStat>

        <BentoTile col={4} row={2}>
          <BentoHeading
            title="XP earned per week"
            hint="Against a 400 XP weekly goal"
            chip={<SampleChip />}
          />
          <TrendLineChart
            data={LEARNER_XP_TREND}
            xKey="week"
            series={[
              { key: 'xp', name: 'XP earned' },
              { key: 'target', name: 'Weekly goal' },
            ]}
            domain={[0, 900]}
            height={168}
            legendNote="Latest week"
          />
        </BentoTile>

        <BentoStat tone="bee" col={1} row={1} icon={Coins} label="Coins" value={coinBalance} />
        <BentoStat tone="beetle" col={1} row={1} icon={Zap} label="AI credits" value={aiCredits} />
        <BentoStat
          tone="feather"
          col={2}
          row={1}
          icon={Trophy}
          label="Completed"
          value={completedEnrollments}
          hint={`${activeEnrollments} still in progress`}
        />
        <BentoStat
          tone="macaw"
          col={2}
          row={1}
          icon={BookOpen}
          label="Enrolled tracks"
          value={certs.length}
          hint="Certifications on your shelf"
        />

        <BentoTile col={4} row={2}>
          <BentoHeading
            title="Mastery by domain"
            hint="Estimated from your answers"
            chip={<SampleChip />}
          />
          <BarBreakdownChart
            data={LEARNER_DOMAIN_MASTERY}
            categoryKey="domain"
            valueKey="mastery"
            unit="%"
            target={70}
            height={186}
          />
        </BentoTile>

        {/* Right of the chart — activity is scanned, so it gets its own column. */}
        <BentoTile col={2} row={2} className="!p-0">
          <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
            <BentoHeading title="recent activity" />

            {activityLogs.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Lessons, practice runs, and assessments you complete will be listed here.
              </p>
            ) : (
              <div className="-mr-2 min-h-0 flex-1 divide-y-2 divide-border overflow-y-auto pr-2">
                {activityLogs.slice(0, 12).map((log, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-3 first:pt-0">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-rb-macaw-wash text-rb-macaw-lip">
                      <Clock className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{log.actionType}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {log.description}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </BentoTile>

        {/* Band 4 — 4 + 2, mirrored against band 3 */}
        <BentoTile col={4} row={2}>
          <BentoHeading
            title="Where your time goes"
            hint="Minutes per day, stacked by activity"
            chip={<SampleChip />}
          />
          <TrendAreaChart
            data={LEARNER_STUDY_MIX}
            xKey="day"
            series={[
              { key: 'lessons', name: 'Lessons' },
              { key: 'practice', name: 'Practice' },
              { key: 'assessments', name: 'Assessments' },
            ]}
            height={168}
            legendNote="Sunday"
          />
        </BentoTile>

        <BentoTile col={2} row={2}>
          <BentoHeading
            title="How your answers land"
            hint="Every question attempted"
            chip={<SampleChip />}
          />
          <DonutChart
            data={LEARNER_ANSWER_MIX}
            height={168}
            centerValue="57%"
            centerLabel="first try"
          />
        </BentoTile>

        {/* Band 5 — one full-width tile */}
        <BentoTile col={6} row={2} className="!p-0">
          <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
            <BentoHeading
              title={`your certifications (${activeEnrollments} in progress)`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => navigate('/learner/certifications')}
                >
                  View all
                </Button>
              }
            />

            {certs.length === 0 ? (
              <LearnerEmptyState
                icon={BookOpen}
                title="No certifications yet"
                description="Browse the catalogue and enrol to start tracking progress here."
                action={
                  <Button
                    className="rounded-full"
                    onClick={() => navigate('/learner/certifications')}
                  >
                    Browse Certifications
                  </Button>
                }
              />
            ) : (
              <div className="-mr-2 grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2 xl:grid-cols-3">
                {certs.slice(0, 6).map((cert) => (
                  <button
                    type="button"
                    key={cert.learnerCertificationId}
                    className="w-full rounded-rb-tile border-2 border-border bg-muted/30 p-3 text-left transition-colors hover:border-rb-macaw/60"
                    onClick={() =>
                      navigate(`/learner/certifications/${cert.learnerCertificationId}`)
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-rb-display font-extrabold text-foreground">
                        {cert.certificationName}
                      </p>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {Math.round(cert.progressPercentage || 0)}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={cert.progressPercentage || 0} />
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                      {cert.status === 'COMPLETED'
                        ? '✓ Completed'
                        : cert.masteryLevel !== undefined
                          ? `Mastery: ${getMasteryLevel(cert.masteryLevel)}`
                          : cert.status || 'In progress'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </BentoTile>
      </BentoGrid>
    </div>
  )
}
