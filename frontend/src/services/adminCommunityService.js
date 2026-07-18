import { base } from "./base"

export const getCommunityReports = (status = "OPEN") => base(`admin/community/reports?status=${encodeURIComponent(status)}`)
export const reviewCommunityReport = (reportId, status) => base(`admin/community/reports/${reportId}`, { method: "PUT", data: { status } })
export const hideCommunityPost = (postId) => base(`admin/community/reports/posts/${postId}/hide`, { method: "PUT" })
