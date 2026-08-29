import { base } from "./base"

/**
 * The learner's own notification preferences, stored server-side.
 *
 * The account page used to keep three invented switches ("learning reminders",
 * "certification updates", "product news") in localStorage, where nothing read
 * them: turning one off changed what the page remembered and nothing else.
 * These five are the ones the backend actually has and acts on.
 *
 * GET creates the row on first read, so a learner who has never opened this
 * page still gets the defaults rather than a 404.
 */
export const NOTIFICATION_PREFERENCE_KEY = "notification-preferences"

export function getMyNotificationPreferences() {
  return base("notification-preferences/me")
}

export function updateMyNotificationPreferences(preferences) {
  return base("notification-preferences/me", {
    method: "PUT",
    data: preferences,
  })
}
