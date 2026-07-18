import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getMasteryHistory } from '@/services/learnerAnalyticsService'
import { LearnerLoadingSkeleton, LearnerEmptyState } from './learner-ui'

/**
 * Mastery Trend Chart - visualizes mastery progression over time
 * Shows how a learner's knowledge probability changes with each assessment
 */
export function MasteryTrendChart({ certificationId, className = '' }) {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['masteryHistory', certificationId],
    queryFn: () => getMasteryHistory(certificationId),
    enabled: Boolean(certificationId),
  })

  if (isLoading) {
    return <LearnerLoadingSkeleton className="h-64" />
  }

  if (error || !history || history.length === 0) {
    return (
      <LearnerEmptyState
        title="No Data Yet"
        message="Take assessments to see your mastery progression"
        className={className}
      />
    )
  }

  // Transform data for chart
  const chartData = history.map((item, index) => ({
    index: index + 1,
    date: new Date(item.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    before: Math.round(item.previous_mastery * 100),
    after: Math.round(item.final_mastery * 100),
    assessment: item.assessment_type,
    correct: item.observed_correct ? '✓' : '✗',
  }))

  const maxValue = 100
  const minValue = 0

  return (
    <div className={`rounded-lg border border-border bg-card p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Mastery Progression</h3>
        <p className="text-sm text-muted-foreground">
          Your knowledge growth across {history.length} assessments
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            domain={[minValue, maxValue]}
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            label={{ value: 'Mastery %', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value) => `${value}%`}
            labelFormatter={(label) => `Assessment ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="before"
            stroke="#94a3b8"
            strokeDasharray="5 5"
            strokeWidth={2}
            name="Before Assessment"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="after"
            stroke="#3b82f6"
            strokeWidth={2}
            name="After Assessment"
            dot={(props) => (
              <CustomDot
                {...props}
                correct={chartData[props.index]?.correct === '✓'}
              />
            )}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 pt-4 border-t border-border space-y-2">
        <p className="text-sm font-medium text-foreground">Quick Stats</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Assessments</p>
            <p className="text-lg font-semibold text-foreground">{history.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Mastery</p>
            <p className="text-lg font-semibold text-foreground">
              {chartData[chartData.length - 1]?.after}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Improvement</p>
            <p className="text-lg font-semibold text-green-600">
              +{chartData[chartData.length - 1]?.after - chartData[0]?.before}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CustomDot(props) {
  const { cx, cy, correct } = props
  if (!cx || !cy) return null

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={correct ? '#10b981' : '#ef4444'}
        stroke="white"
        strokeWidth={2}
      />
    </g>
  )
}
