/**
 * Reading a study plan's schedule: when a session is due, and how to say so.
 *
 * Shared because three surfaces answer the same question and must agree — the
 * scheduler deciding whether to fire, the Today's Plan tile printing the time,
 * and the calendar. If they disagreed, a session would announce one time and
 * fire at another.
 */

/**
 * A local YYYY-MM-DD, as the plan generator writes it.
 *
 * `toISOString().slice(0,10)` is the obvious thing here and is wrong — it
 * converts to UTC first, so anywhere east of Greenwich the early hours of a day
 * report yesterday's date, and every session would be due on the wrong day for
 * the first several hours of every morning.
 */
export function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Minutes past local midnight, from an "HH:mm". Null when unparseable. */
export function minutesOfDay(at) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(at ?? "").trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  return hours * 60 + minutes
}

/** "7:00 PM" from "19:00", in the viewer's own locale conventions. */
export function formatClockTime(at) {
  const total = minutesOfDay(at)
  if (total == null) return null

  const date = new Date()
  date.setHours(Math.floor(total / 60), total % 60, 0, 0)
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/**
 * When a session happens, in words: "Today · 7:00 PM", "Tomorrow · 7:00 PM",
 * "Fri 12 Sep · 7:00 PM".
 *
 * Falls back to the event's own `time` copy for plans generated before events
 * carried a machine time, so those still read sensibly instead of going blank.
 */
export function formatWhen(event, now = new Date()) {
  const clock = formatClockTime(event?.at) ?? event?.time ?? null
  const dateKey = event?.dateKey

  if (!dateKey) return clock

  const todayKey = toDateKey(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  const day =
    dateKey === todayKey
      ? "Today"
      : dateKey === toDateKey(tomorrow)
        ? "Tomorrow"
        : new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })

  return clock ? `${day} · ${clock}` : day
}

/**
 * The event types a technique actually runs for.
 *
 * A mock exam checkpoint and the target-exam marker are not technique sessions
 * — auto-launching a recall quiz because the plan says "sit a mock exam today"
 * would replace the thing the learner is supposed to do with a different thing.
 */
const TRIGGERABLE_TYPES = new Set(["lesson", "review", "quiz", "catch-up"])

export function isTriggerable(event) {
  return (
    Boolean(event?.technique) &&
    minutesOfDay(event?.at) != null &&
    TRIGGERABLE_TYPES.has(event?.type)
  )
}

/**
 * Whether a session's moment has arrived: today, and the clock has reached it.
 *
 * Deliberately "at or after" rather than "exactly at". A tab that was closed at
 * 7:00 PM and opened at 8:15 has still missed the session, and a scheduler that
 * only fires on the exact minute would silently skip every session the learner
 * was not already sitting in front of — which is most of them.
 */
export function isDue(event, now = new Date()) {
  if (!isTriggerable(event)) return false
  if (event.dateKey !== toDateKey(now)) return false

  return now.getHours() * 60 + now.getMinutes() >= minutesOfDay(event.at)
}
