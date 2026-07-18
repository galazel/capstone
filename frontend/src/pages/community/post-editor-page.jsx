import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCommunity } from '@/hooks/useCommunity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit, Trash2 } from 'lucide-react'

export default function PostEditorPage() {
  const [searchParams] = useSearchParams()
  const postId = searchParams.get('id')
  const { editPost, deletePost, loading } = useCommunity()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (postId) {
      // Fetch existing post data
      // This would normally come from an API call
      setTitle('Sample Post Title')
      setBody('Sample post body content...')
    }
  }, [postId])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!postId) return

    await editPost(postId, title, body)
    // Redirect to post view
    window.location.href = `/community/posts/${postId}`
  }

  const handleDelete = async () => {
    if (!postId) return
    await deletePost(postId)
    // Redirect to community feed
    window.location.href = '/community'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Edit className="w-8 h-8 text-blue-500" />
          <h1 className="text-4xl font-bold">Edit Post</h1>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Post Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Post title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Write your post content here..."
                  rows={10}
                  required
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-6 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center gap-2 font-semibold"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-red-600 mb-4">Delete Post?</h3>
              <p className="text-slate-700 mb-6">
                This action cannot be undone. The post will be permanently deleted.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete Post'}
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
