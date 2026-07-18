import { useState } from 'react'
import { toast } from 'sonner'
import api from '@/services/api'

export function useAssessment() {
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(null)

  const startAttempt = async (assessmentId) => {
    try {
      setLoading(true)
      const response = await api.post(`/assessments/${assessmentId}/attempts`)
      setAttempt(response.data)
      toast.success('Assessment started')
      return response.data
    } catch (err) {
      toast.error('Failed to start assessment')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const submitAnswer = async (attemptId, questionId, answer) => {
    try {
      const response = await api.post(`/assessments/attempts/${attemptId}/submit-answer`, null, {
        params: { questionId, answer },
      })
      setAttempt(response.data)
      return response.data
    } catch (err) {
      toast.error('Failed to submit answer')
      throw err
    }
  }

  const submitAttempt = async (attemptId) => {
    try {
      setLoading(true)
      const response = await api.post(`/assessments/attempts/${attemptId}/submit`)
      setAttempt(response.data)
      toast.success('Assessment submitted!')
      return response.data
    } catch (err) {
      toast.error('Failed to submit assessment')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { attempt, startAttempt, submitAnswer, submitAttempt, loading }
}
