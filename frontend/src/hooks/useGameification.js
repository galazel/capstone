import { useEffect, useState } from 'react'
import api from '@/services/api'

export function useGameification() {
  const [leaderboard, setLeaderboard] = useState([])
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
    fetchStreak()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/leaderboards/xp?limit=100')
      setLeaderboard(res.data)
    } catch (err) {
      console.error('Failed to load leaderboard', err)
    }
  }

  const fetchStreak = async () => {
    try {
      const res = await api.get('/streaks/me')
      setStreak(res.data)
    } catch (err) {
      console.error('Failed to load streak', err)
    } finally {
      setLoading(false)
    }
  }

  const recordActivity = async () => {
    try {
      await api.post('/streaks/me/record')
      fetchStreak()
    } catch (err) {
      console.error('Failed to record activity', err)
    }
  }

  return { leaderboard, streak, loading, recordActivity, refetch: fetchLeaderboard }
}
