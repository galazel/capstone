import { useState } from 'react'
import { toast } from 'sonner'
import api from '@/services/api'

export function useLesson() {
  const [loading, setLoading] = useState(false)

  const completeLesson = async (lessonId) => {
    try {
      setLoading(true)
      const response = await api.post(`/lessons/${lessonId}/complete`)
      toast.success('Lesson completed! Keep up the momentum 🎉')
      return response.data
    } catch (err) {
      toast.error('Failed to complete lesson')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { completeLesson, loading }
}
