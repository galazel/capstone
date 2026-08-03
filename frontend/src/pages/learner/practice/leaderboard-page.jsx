import { useGamification } from '@/hooks/useGamification'
import { Trophy, Medal } from "@/components/icons"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LeaderboardPage() {
  const { leaderboard, loading } = useGamification()

  if (loading) return <div className="p-8">Loading leaderboard...</div>

  const getMedalColor = (rank) => {
    if (rank === 1) return 'text-yellow-500'
    if (rank === 2) return 'text-gray-400'
    if (rank === 3) return 'text-orange-600'
    return 'text-slate-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h1 className="text-4xl font-bold">XP Leaderboard</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top 100 Learners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leaderboard.slice(0, 100).map((entry, idx) => (
                <div
                  key={entry.learnerId}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10">
                      {entry.rank <= 3 ? (
                        <Medal className={`w-6 h-6 ${getMedalColor(entry.rank)}`} />
                      ) : (
                        <span className="text-lg font-bold text-slate-600">#{entry.rank}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{entry.learnerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{entry.totalXp.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">XP</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
