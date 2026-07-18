import { useState } from 'react'
import { toast } from 'sonner'
import api from '@/services/api'

export function useCommunity() {
  const [loading, setLoading] = useState(false)

  const editPost = async (postId, title, body) => {
    try {
      setLoading(true)
      const response = await api.put(`/community/posts/${postId}`, { title, body })
      toast.success('Post updated')
      return response.data
    } catch (err) {
      toast.error('Failed to update post')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deletePost = async (postId) => {
    try {
      setLoading(true)
      await api.delete(`/community/posts/${postId}`)
      toast.success('Post deleted')
    } catch (err) {
      toast.error('Failed to delete post')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { editPost, deletePost, loading }
}
