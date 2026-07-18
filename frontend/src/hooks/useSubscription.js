import { useState } from 'react'
import { toast } from 'sonner'
import api from '@/services/api'

export function useSubscription() {
  const [loading, setLoading] = useState(false)

  const startCheckout = async (plan) => {
    try {
      setLoading(true)
      const res = await api.post('/payments/checkout', { planId: plan })
      // Redirect to PayMongo checkout
      if (res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl
      }
    } catch (err) {
      toast.error('Failed to start checkout')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getSubscriptionStatus = async () => {
    try {
      const res = await api.get('/payments/subscription-status')
      return res.data
    } catch (err) {
      console.error('Failed to check subscription', err)
      return null
    }
  }

  return { startCheckout, getSubscriptionStatus, loading }
}
