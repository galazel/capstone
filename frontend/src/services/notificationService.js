import { base } from "./base"

// The signed-in user's own in-app notifications -- any role. Partnership
// requests submitted/approved/rejected and invitation sent/accepted all
// land here (see backend NotificationController).
export function getMyNotifications() {
  return base("notifications")
}

export function markNotificationRead(notificationId) {
  return base(`notifications/${notificationId}/read`, { method: "PUT" })
}
