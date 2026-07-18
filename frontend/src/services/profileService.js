/**
 * Learner profile management service
 */
import api from './api'

export const profileService = {
  /**
   * Update learner profile (first name, last name, email)
   */
  async updateProfile(firstName, lastName, email) {
    try {
      const response = await api.put('/learners/me', {
        firstName,
        lastName,
        email
      })
      return response.data
    } catch (error) {
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.error || 'Invalid profile data')
      }
      throw error
    }
  },

  /**
   * Change password with old password verification
   */
  async changePassword(oldPassword, newPassword) {
    try {
      const response = await api.post('/learners/me/change-password', {
        oldPassword,
        newPassword
      })
      return response.data
    } catch (error) {
      if (error.response?.status === 422) {
        throw new Error(error.response.data?.error || 'Failed to change password')
      }
      throw error
    }
  },

  /**
   * Delete learner account (requires password confirmation)
   */
  async deleteAccount(password) {
    try {
      const response = await api.delete('/learners/me', {
        data: { password }
      })
      return response.data
    } catch (error) {
      if (error.response?.status === 422) {
        throw new Error(error.response.data?.error || 'Failed to delete account')
      }
      throw error
    }
  }
}

export default profileService
