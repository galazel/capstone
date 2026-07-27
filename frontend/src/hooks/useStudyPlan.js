import { useState } from 'react'
import { toast } from 'sonner'
import { base } from '@/services/base'

export function useStudyPlan() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)

  const generatePlan = async (goal) => {
    try {
      setLoading(true)
      const data = await base('study-plans/generate', { method: 'POST', data: { goal } })
      setPlans(prev => [data, ...prev])
      toast.success('Study plan created!')
      return data
    } catch (err) {
      toast.error('Failed to generate plan')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getPlans = async () => {
    try {
      const data = await base('study-plans/my-plans')
      setPlans(data)
    } catch (err) {
      console.error('Failed to load plans', err)
    }
  }

  const completePlan = async (planId) => {
    try {
      await base(`study-plans/${planId}/complete`, { method: 'POST' })
      toast.success('Plan completed!')
      getPlans()
    } catch (err) {
      toast.error('Failed to complete plan')
      throw err
    }
  }

  return { plans, generatePlan, getPlans, completePlan, loading }
}
