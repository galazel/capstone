import { useState } from 'react'
import { toast } from 'sonner'
import { base } from '@/services/base'

export function useAssessment() {
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(null)

  const startAttempt = async (assessmentId) => {
    try {
      setLoading(true)
      const data = await base(`assessments/${assessmentId}/attempts`, { method: 'POST' })
      setAttempt(data)
      toast.success('Assessment started')
      return data
    } catch (err) {
      toast.error('Failed to start assessment')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const submitAnswer = async (attemptId, questionId, answer) => {
    try {
      const data = await base(
        `assessments/attempts/${attemptId}/submit-answer?questionId=${encodeURIComponent(questionId)}&answer=${encodeURIComponent(answer)}`,
        { method: 'POST' }
      )
      setAttempt(data)
      return data
    } catch (err) {
      toast.error('Failed to submit answer')
      throw err
    }
  }

  const submitAttempt = async (attemptId) => {
    try {
      setLoading(true)
      const data = await base(`assessments/attempts/${attemptId}/submit`, { method: 'POST' })
      setAttempt(data)
      toast.success('Assessment submitted!')
      return data
    } catch (err) {
      toast.error('Failed to submit assessment')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { attempt, startAttempt, submitAnswer, submitAttempt, loading }
}
