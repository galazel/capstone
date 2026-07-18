/**
 * PayMongo Hosted Checkout Integration
 * Uses PayMongo's hosted checkout for secure payment processing
 */

import api from './api'

export const paymongoService = {
  /**
   * Get available subscription plans
   */
  async getPlans() {
    try {
      const response = await api.get('/subscription/plans')
      return response.data
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error)
      throw error
    }
  },

  /**
   * Initiate PayMongo hosted checkout
   * Redirects learner to PayMongo's hosted checkout page
   */
  async initiateCheckout(planId) {
    try {
      const response = await api.post(`/subscription/checkout/${planId}`)
      if (response.data.checkout_url) {
        // Redirect to PayMongo hosted checkout
        window.location.href = response.data.checkout_url
        return true
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error) {
      console.error('Failed to initiate checkout:', error)
      throw error
    }
  },

  /**
   * Verify payment after learner returns from hosted checkout
   * Called with session ID from PayMongo redirect
   */
  async verifyPayment(sessionId) {
    try {
      const response = await api.get(`/subscription/verify/${sessionId}`)
      return response.data
    } catch (error) {
      console.error('Failed to verify payment:', error)
      throw error
    }
  }
}

export default paymongoService
