import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import api from '@/services/api'

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/notification-preferences/me')
      setPrefs(res.data)
    } catch (err) {
      console.error('Failed to load preferences', err)
    } finally {
      setLoading(false)
    }
  }

  const updatePreferences = async (updates) => {
    try {
      const res = await api.put('/notification-preferences/me', updates)
      setPrefs(res.data)
      toast.success('Preferences updated')
      return res.data
    } catch (err) {
      toast.error('Failed to update preferences')
      throw err
    }
  }

  return { prefs, loading, updatePreferences }
}
