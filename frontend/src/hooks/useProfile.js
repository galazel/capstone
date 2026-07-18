import { useState } from 'react'
import { toast } from 'sonner'
import profileService from '@/services/profileService'

/**
 * Hook for managing learner profile updates
 */
export function useProfile() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const updateProfile = async (firstName, lastName, email) => {
    try {
      setLoading(true)
      setError(null)
      const result = await profileService.updateProfile(firstName, lastName, email)
      toast.success('Profile updated successfully')
      return result
    } catch (err) {
      const message = err.message || 'Failed to update profile'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const changePassword = async (oldPassword, newPassword) => {
    try {
      setLoading(true)
      setError(null)
      await profileService.changePassword(oldPassword, newPassword)
      toast.success('Password changed successfully')
    } catch (err) {
      const message = err.message || 'Failed to change password'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deleteAccount = async (password) => {
    try {
      setLoading(true)
      setError(null)
      await profileService.deleteAccount(password)
      toast.success('Account deleted')
      // Redirect to login
      window.location.href = '/login'
    } catch (err) {
      const message = err.message || 'Failed to delete account'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updateProfile, changePassword, deleteAccount, loading, error }
}
