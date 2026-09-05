import { base } from "./base"

const COMMUNITY_FEED_SNAPSHOT_KEY = "rebyu:community-feed-snapshot"

export function readCommunityFeedSnapshot() {
  try {
    const raw = sessionStorage.getItem(COMMUNITY_FEED_SNAPSHOT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeCommunityFeedSnapshot(data) {
  try {
    sessionStorage.setItem(COMMUNITY_FEED_SNAPSHOT_KEY, JSON.stringify(data))
  } catch {
    // Storage is an optional fast path; live API data remains authoritative.
  }
}

const relativeHours = (value) => {
  const time = value ? new Date(value).getTime() : NaN
  if (!Number.isFinite(time)) {
    return "recently"
  }

  const hoursAgo = Math.max(0, Math.round((Date.now() - time) / 3600000))
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-hoursAgo, "hour")
}

const postView = (post) => ({
  ...post,
  badge: post.ownedByMe ? "You" : "Learner",
  badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  community: post.community || "Community",
  createdAt: relativeHours(post.createdAt),
  attachment: post.attachmentName ? {
    name: post.attachmentName,
    type: post.attachmentType || "PDF",
    meta: "Community resource",
    key: post.attachmentKey || null,
  } : null,
})

/** Applies a {reactions, saves, active} count payload to one post in a list. */
export const applyPostCounts = (posts, postId, counts, field) =>
  posts.map((post) =>
    post.postId === postId
      ? {
          ...post,
          reactions: counts.reactions ?? post.reactions,
          saves: counts.saves ?? post.saves,
          ...(field ? { [field]: counts.active } : {}),
        }
      : post
  )

export async function getCommunityPosts({ type, search, saved } = {}) {
  const params = new URLSearchParams()
  if (type) params.set("type", type)
  if (search) params.set("search", search)
  if (saved) params.set("saved", "true")
  const query = params.toString()
  const posts = await base(query ? `community/posts?${query}` : "community/posts")
  return posts.map(postView)
}
export const getCommunityCircles = () => base("community/circles")
export const createCommunityPost = async (payload) => postView(await base("community/posts", { method: "POST", data: payload }))
export const createCommunityCircle = (payload) => base("community/circles", { method: "POST", data: payload })
export const shareCommunityStudyItem = async (libraryItemId, circleId = null) =>
  postView(await base(`community/posts/shared-study-item/${libraryItemId}`, { method: "POST", data: { circleId } }))
export const startSharedCommunityPractice = (postId) => base(`community/posts/${postId}/practice`, { method: "POST" })
export const reportCommunityPost = (postId, reason, details = null) =>
  base(`community/posts/${postId}/report`, { method: "POST", data: { reason, details } })
export const getCommunityNotifications = () => base("community/notifications")
export const markCommunityNotificationRead = (notificationId) =>
  base(`community/notifications/${notificationId}/read`, { method: "PUT" })
export const markAllCommunityNotificationsRead = () =>
  base("community/notifications/read-all", { method: "PUT" })
export const deleteCommunityNotification = (notificationId) =>
  base(`community/notifications/${notificationId}`, { method: "DELETE" })
export const deleteAllCommunityNotifications = () =>
  base("community/notifications", { method: "DELETE" })
export const toggleCommunityLike = (id) => base(`community/posts/${id}/like`, { method: "POST" })
export const toggleCommunitySave = (id) => base(`community/posts/${id}/save`, { method: "POST" })
export const toggleCircleMembership = (id) => base(`community/circles/${id}/membership`, { method: "POST" })
/** Owner-only; also removes the posts written in the circle. */
export const deleteCommunityCircle = (id) => base(`community/circles/${id}`, { method: "DELETE" })
export const getCommunityComments = (id) => base(`community/posts/${id}/comments`)
export const addCommunityComment = (id, body, parentCommentId = null) => base(`community/posts/${id}/comments`, { method: "POST", data: { body, parentCommentId } })
export const deleteCommunityPost = (id) => base(`community/posts/${id}`, { method: "DELETE" })

/** Uploads a real PDF/DOCX attachment; returns { attachmentKey }. Call before createCommunityPost. */
export async function uploadCommunityAttachment(file) {
  const formData = new FormData()
  formData.append("file", file)
  return base("community/posts/attachment", { method: "POST", data: formData })
}
