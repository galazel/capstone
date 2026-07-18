import { useState } from 'react'
import { useStudyPlan } from '@/hooks/useStudyPlan'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Plus, CheckCircle } from 'lucide-react'

export default function StudyPlanPage() {
  const { plans, generatePlan, getPlans, completePlan, loading } = useStudyPlan()
  const [goal, setGoal] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!goal.trim()) return
    setGenerating(true)
    try {
      await generatePlan(goal)
      setGoal('')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-8 h-8 text-blue-500" />
          <h1 className="text-4xl font-bold">Study Plans</h1>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Generate New Study Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Learn React Hooks in 4 weeks"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !goal.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="inline w-4 h-4 mr-2" />
                Generate
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card key={plan.planId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{plan.goal}</CardTitle>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    plan.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {plan.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-slate-600">
                    {plan.schedule && Object.keys(plan.schedule).length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(plan.schedule).map(([key, value]) => (
                          <div key={key} className="p-2 bg-slate-50 rounded">
                            <p className="font-semibold">{key}</p>
                            <p className="text-xs">{value}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500">Generating schedule...</p>
                    )}
                  </div>
                  {plan.status === 'ACTIVE' && (
                    <button
                      onClick={() => completePlan(plan.planId)}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete Plan
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {plans.length === 0 && (
          <Card>
            <CardContent className="pt-8 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No study plans yet. Create one to get started!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
