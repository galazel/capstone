import { useEffect, useState } from 'react'
import { base } from '@/services/base'
import { getLeaderboard } from '@/services/gamificationService'

export function useGamification() {
  const [leaderboard, setLeaderboard] = useState([])
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
    fetchStreak()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const data = await getLeaderboard()
      setLeaderboard(data)
    } catch (err) {
      console.error('Failed to load leaderboard', err)
    }
  }

  const fetchStreak = async () => {
    try {
      const data = await base('streaks/me')
      setStreak(data)
    } catch (err) {
      console.error('Failed to load streak', err)
    } finally {
      setLoading(false)
    }
  }

  const recordActivity = async () => {
    try {
      await base('streaks/me/record', { method: 'POST' })
      fetchStreak()
    } catch (err) {
      console.error('Failed to record activity', err)
    }
  }

  return { leaderboard, streak, loading, recordActivity, refetch: fetchLeaderboard }
}
