import { useState } from 'react'
import { toast } from 'sonner'
import { base } from '@/services/base'
import { deleteCommunityPost } from '@/services/communityService'

export function useCommunity() {
  const [loading, setLoading] = useState(false)

  const editPost = async (postId, title, body) => {
    try {
      setLoading(true)
      const data = await base(`community/posts/${postId}`, { method: 'PUT', data: { title, body } })
      toast.success('Post updated')
      return data
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
      await deleteCommunityPost(postId)
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
