import { useState } from 'react'
import { toast } from 'sonner'
import api from '@/services/api'

export function useStudyPlan() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)

  const generatePlan = async (goal) => {
    try {
      setLoading(true)
      const res = await api.post('/study-plans/generate', { goal })
      setPlans(prev => [res.data, ...prev])
      toast.success('Study plan created!')
      return res.data
    } catch (err) {
      toast.error('Failed to generate plan')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getPlans = async () => {
    try {
      const res = await api.get('/study-plans/my-plans')
      setPlans(res.data)
    } catch (err) {
      console.error('Failed to load plans', err)
    }
  }

  const completePlan = async (planId) => {
    try {
      await api.post(`/study-plans/${planId}/complete`)
      toast.success('Plan completed!')
      getPlans()
    } catch (err) {
      toast.error('Failed to complete plan')
      throw err
    }
  }

  return { plans, generatePlan, getPlans, completePlan, loading }
}
