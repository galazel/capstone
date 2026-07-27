import { useState } from 'react'
import { toast } from 'sonner'
import { base } from '@/services/base'

export function useLesson() {
  const [loading, setLoading] = useState(false)

  const completeLesson = async (lessonId) => {
    try {
      setLoading(true)
      const data = await base(`lessons/${lessonId}/complete`, { method: 'POST' })
      toast.success('Lesson completed! Keep up the momentum 🎉')
      return data
    } catch (err) {
      toast.error('Failed to complete lesson')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { completeLesson, loading }
}
