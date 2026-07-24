import { fetchEventSource } from "@microsoft/fetch-event-source"

import { API, base, currentAccessToken } from "./base"

// The signed-in user's own in-app notifications -- any role. Partnership
// requests submitted/approved/rejected and invitation sent/accepted all
// land here (see backend NotificationController).
export function getMyNotifications() {
  return base("notifications")
}

export function markNotificationRead(notificationId) {
  return base(`notifications/${notificationId}/read`, { method: "PUT" })
}

export function markAllNotificationsRead() {
  return base("notifications/read-all", { method: "PUT" })
}

export function deleteNotification(notificationId) {
  return base(`notifications/${notificationId}`, { method: "DELETE" })
}

export function deleteAllNotifications() {
  return base("notifications", { method: "DELETE" })
}

/**
 * Opens the live notification stream and calls `onNotification` for each event
 * the server pushes, replacing the fixed-interval polling this feed used to do.
 *
 * Server-Sent Events rather than a WebSocket: the feed is one-way, so it needs
 * no broker and no STOMP handshake, and it rides the ordinary authenticated
 * /api route. The native `EventSource` cannot set an Authorization header,
 * which is exactly why this uses fetch-event-source instead.
 *
 * Returns a function that closes the stream.
 */
export function streamNotifications({ onNotification, onOpen } = {}) {
  const controller = new AbortController()

  const run = async () => {
    const token = await currentAccessToken()
    if (!token || controller.signal.aborted) return

    try {
      await fetchEventSource(`${API}/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        // Keep the stream open in background tabs, so a notification that
        // arrives while the tab is hidden still lands immediately.
        openWhenHidden: true,
        async onopen(response) {
          if (response.ok) {
            onOpen?.()
            return
          }
          // 401/403 means the session is gone -- retrying would just spin.
          throw new Error(`Notification stream failed: ${response.status}`)
        },
        onmessage(event) {
          if (event.event !== "notification" || !event.data) return
          try {
            onNotification?.(JSON.parse(event.data))
          } catch {
            // A malformed frame should never take the whole stream down.
          }
        },
        onerror(error) {
          // Returning lets the library retry with backoff; throwing ends the
          // stream for good, so only give up once the caller has unmounted.
          if (controller.signal.aborted) throw error
        },
      })
    } catch {
      // Aborted on unmount, or the session ended -- nothing to recover here.
    }
  }

  run()
  return () => controller.abort()
}
