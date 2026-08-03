/**
 * Placeholder series for the dashboard chart previews.
 *
 * These are invented numbers, shaped to look plausible so the layout can be
 * judged before the analytics endpoints exist. Every panel that renders them
 * carries a "sample data" chip — nothing here should ever be read as a real
 * measurement, and each block names the endpoint that will replace it.
 */

/* ------------------------------------------------------------------ learner */

// replace with: GET /api/learners/me/analytics/xp-history
export const LEARNER_XP_TREND = [
  { week: "W1", xp: 320, target: 400 },
  { week: "W2", xp: 465, target: 400 },
  { week: "W3", xp: 380, target: 400 },
  { week: "W4", xp: 540, target: 400 },
  { week: "W5", xp: 610, target: 400 },
  { week: "W6", xp: 585, target: 400 },
  { week: "W7", xp: 720, target: 400 },
  { week: "W8", xp: 815, target: 400 },
]

// replace with: GET /api/learners/me/analytics/mastery-by-domain (BKT)
export const LEARNER_DOMAIN_MASTERY = [
  { domain: "Databases", mastery: 38 },
  { domain: "Networks", mastery: 46 },
  { domain: "Security", mastery: 61 },
  { domain: "Operating sys.", mastery: 68 },
  { domain: "Programming", mastery: 79 },
  { domain: "Foundation", mastery: 92 },
]

// replace with: GET /api/learners/me/analytics/study-minutes
export const LEARNER_STUDY_MIX = [
  { day: "Mon", lessons: 24, practice: 18, assessments: 0 },
  { day: "Tue", lessons: 31, practice: 22, assessments: 15 },
  { day: "Wed", lessons: 18, practice: 34, assessments: 0 },
  { day: "Thu", lessons: 40, practice: 12, assessments: 25 },
  { day: "Fri", lessons: 22, practice: 28, assessments: 0 },
  { day: "Sat", lessons: 55, practice: 41, assessments: 45 },
  { day: "Sun", lessons: 12, practice: 16, assessments: 0 },
]

// replace with: GET /api/learners/me/analytics/answer-outcomes
export const LEARNER_ANSWER_MIX = [
  { name: "First try", value: 214 },
  { name: "After a retry", value: 96 },
  { name: "Still wrong", value: 47 },
  { name: "Skipped", value: 18, isOther: true },
]

// replace with: GET /api/learners/me/analytics/mastery-trend (BKT)
export const LEARNER_MASTERY_TREND = [
  { week: "W1", databases: 22, programming: 55 },
  { week: "W2", databases: 28, programming: 63 },
  { week: "W3", databases: 31, programming: 70 },
  { week: "W4", databases: 34, programming: 74 },
  { week: "W5", databases: 36, programming: 76 },
  { week: "W6", databases: 38, programming: 79 },
]

/* -------------------------------------------------------------- challenges */

// replace with: GET /api/challenges/me/score-history
export const CHALLENGE_SCORE_TREND = [
  { run: "R1", codestrike: 96, blueprint: 74 },
  { run: "R2", codestrike: 118, blueprint: 88 },
  { run: "R3", codestrike: 134, blueprint: 96 },
  { run: "R4", codestrike: 129, blueprint: 121 },
  { run: "R5", codestrike: 158, blueprint: 133 },
  { run: "R6", codestrike: 181, blueprint: 164 },
]

// replace with: GET /api/challenges/me/summary
export const CHALLENGE_ARENA_MIX = [
  { name: "CodeStrike", value: 14 },
  { name: "Blueprint Arena", value: 9 },
  { name: "World Cup", value: 4 },
]

/* ----------------------------------------------------------------- admin */

// replace with: GET /api/admin/analytics/growth
export const ADMIN_GROWTH_TREND = [
  { month: "Feb", learners: 420, enterprises: 6 },
  { month: "Mar", learners: 610, enterprises: 8 },
  { month: "Apr", learners: 845, enterprises: 11 },
  { month: "May", learners: 1120, enterprises: 14 },
  { month: "Jun", learners: 1465, enterprises: 18 },
  { month: "Jul", learners: 1880, enterprises: 23 },
]

// replace with: GET /api/admin/analytics/enrollment-mix
export const ADMIN_ENROLLMENT_MIX = [
  { name: "TOPCIT", value: 640 },
  { name: "FE Exam", value: 415 },
  { name: "IT Passport", value: 288 },
  { name: "Other tracks", value: 173, isOther: true },
]

// replace with: GET /api/admin/analytics/attempt-volume
export const ADMIN_ATTEMPT_VOLUME = [
  { month: "Feb", practice: 1240, assessments: 310 },
  { month: "Mar", practice: 1680, assessments: 425 },
  { month: "Apr", practice: 2140, assessments: 588 },
  { month: "May", practice: 2610, assessments: 702 },
  { month: "Jun", practice: 3180, assessments: 861 },
  { month: "Jul", practice: 3925, assessments: 1043 },
]

// replace with: GET /api/admin/analytics/pass-rate
export const ADMIN_PASS_RATE_BY_CERT = [
  { certification: "IT Passport", passRate: 81 },
  { certification: "TOPCIT", passRate: 68 },
  { certification: "FE Exam", passRate: 57 },
  { certification: "AP Exam", passRate: 44 },
]

/* ------------------------------------------------------------- enterprise */

// replace with: GET /api/enterprise/me/analytics/seat-usage
export const ENTERPRISE_SEAT_TREND = [
  { month: "Feb", assigned: 42, active: 31 },
  { month: "Mar", assigned: 58, active: 44 },
  { month: "Apr", assigned: 74, active: 61 },
  { month: "May", assigned: 90, active: 72 },
  { month: "Jun", assigned: 104, active: 88 },
  { month: "Jul", assigned: 120, active: 97 },
]

// replace with: GET /api/enterprise/me/analytics/completion-mix
export const ENTERPRISE_COMPLETION_MIX = [
  { name: "Completed", value: 46 },
  { name: "In progress", value: 58 },
  { name: "Not started", value: 16, isOther: true },
]

// replace with: GET /api/enterprise/me/analytics/group-progress
export const ENTERPRISE_GROUP_PROGRESS = [
  { group: "BSIT 4A", completion: 78 },
  { group: "BSIT 4B", completion: 64 },
  { group: "BSCS 3A", completion: 52 },
  { group: "Night class", completion: 39 },
]

// replace with: GET /api/enterprise/me/analytics/activity
export const ENTERPRISE_ACTIVITY_TREND = [
  { week: "W1", lessons: 210, practice: 148, assessments: 42 },
  { week: "W2", lessons: 265, practice: 172, assessments: 51 },
  { week: "W3", lessons: 232, practice: 196, assessments: 38 },
  { week: "W4", lessons: 301, practice: 224, assessments: 74 },
  { week: "W5", lessons: 348, practice: 261, assessments: 66 },
  { week: "W6", lessons: 392, practice: 288, assessments: 95 },
]
