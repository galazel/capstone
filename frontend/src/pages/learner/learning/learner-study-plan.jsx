import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useQueries, useQuery } from "@tanstack/react-query"

import {
    getProgressAnalytics,
    progressAnalyticsQueryKey,
} from "@/services/learnerAnalyticsService.js"
import {
    ArrowLeft,
    BookOpenCheck,
    Brain,
    CalendarDays,
    CheckCircle2,
    Clock3,
    ListChecks,
    Repeat2,
    Sparkles,
    Target,
    TimerReset,
} from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const readinessOptions = [
    "Ready 1 week before the exam",
    "Ready 2 weeks before the exam",
    "Ready 1 month before the exam",
    "Steady long-term review",
]

const priorityOptions = [
    "Main certification goal",
    "Weak topic improvement",
    "Mock exam preparation",
    "Daily learning consistency",
]

const studyDaysOptions = [
    "3 days per week",
    "4 days per week",
    "5 days per week",
    "6 days per week",
    "Every day",
]

const studyWindowOptions = [
    "Morning · 7:00 AM",
    "Afternoon · 2:00 PM",
    "Evening · 7:00 PM",
    "Late night · 10:00 PM",
]

/* The clock time behind each window, as 24-hour HH:mm.
 *
 * The window is a sentence ("Evening · 7:00 PM") because that is what reads
 * well in a form. A scheduler cannot fire on a sentence, and re-parsing that
 * string at trigger time would make the plan's copy load-bearing -- reword the
 * option and every scheduled session silently stops firing. So the machine
 * time is stored on each event beside the words, and the two are derived from
 * one place here. */
const STUDY_WINDOW_TIMES = {
    "Morning · 7:00 AM": "07:00",
    "Afternoon · 2:00 PM": "14:00",
    "Evening · 7:00 PM": "19:00",
    "Late night · 10:00 PM": "22:00",
}

const DEFAULT_STUDY_TIME = "19:00"

const studyTechniques = [
    {
        id: "spaced-repetition",
        title: "Spaced Repetition",
        description:
            "Review lessons repeatedly across different days to improve long-term memory.",
        icon: Repeat2,
    },
    {
        id: "active-recall",
        title: "Active Recall",
        description:
            "Practice remembering answers before checking notes or explanations.",
        icon: Brain,
    },
    {
        id: "pomodoro",
        title: "Pomodoro",
        description:
            "Study in focused sessions with short breaks to avoid burnout.",
        icon: TimerReset,
    },
]

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** What an overall plan is named wherever a certification title would go. */
export const OVERALL_CERTIFICATION_LABEL = "All certifications"

/* How many weak topics an overall plan carries into the schedule.
   Uncapped, this is every certification's worst topics concatenated, which
   turns the priority section into a wall of badges and gives the generator a
   rotation so long that nothing is ever revisited before the exam. */
const OVERALL_PRIORITY_TOPIC_LIMIT = 12

function parseDate(value) {
    return new Date(`${value}T00:00:00`)
}

function addDays(date, days) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

function toDateKey(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function formatMonthYear(date) {
    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    })
}

function getStudyDaysCount(value) {
    if (value === "Every day") {
        return 7
    }

    const match = value.match(/\d+/)

    return match ? Number(match[0]) : 5
}

function getEventClassName(type) {
    if (type === "review") {
        return "bg-sky-100 text-sky-700 ring-sky-200"
    }

    if (type === "quiz") {
        return "bg-blue-100 text-blue-700 ring-blue-200"
    }

    if (type === "mock") {
        return "bg-amber-100 text-amber-700 ring-amber-200"
    }

    if (type === "catch-up") {
        return "bg-emerald-100 text-emerald-700 ring-emerald-200"
    }

    return "bg-primary/10 text-primary ring-primary/20"
}

function buildMonthDays(viewDate) {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const startDate = new Date(firstDayOfMonth)

    startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + index)

        return {
            date,
            key: toDateKey(date),
            isCurrentMonth: date.getMonth() === month,
            day: date.getDate(),
        }
    })
}

function generateStudyEvents({
                                 calendarStart,
                                 targetExamDate,
                                 studyDays,
                                 studyWindow,
                                 selectedTechniqueInfo,
                                 priorityTopics,
                             }) {
    // The clock time every session on this plan fires at, resolved once.
    const at = STUDY_WINDOW_TIMES[studyWindow] ?? DEFAULT_STUDY_TIME
    const technique = selectedTechniqueInfo?.id ?? null
    const startDate = parseDate(calendarStart)
    const examDate = parseDate(targetExamDate)
    const studyDaysCount = getStudyDaysCount(studyDays)

    /* Lessons, not just their names -- each session records which lesson it is
       for so a recall session can ask the server for that lesson's questions.
       The placeholder carries a null id: there is no lesson behind it, and
       pretending otherwise would send the server looking for one. */
    const topics =
        Array.isArray(priorityTopics) && priorityTopics.length > 0
            ? priorityTopics
            : [{ lessonId: null, title: "Core certification lesson" }]

    const events = []
    const currentDate = new Date(startDate)

    let sessionNumber = 1
    let weeklyStudyCount = 0

    while (currentDate <= examDate && events.length < 90) {
        const day = currentDate.getDay()
        const isSunday = day === 0
        const isStudyDay =
            studyDaysCount === 7 || (!isSunday && weeklyStudyCount < studyDaysCount)

        if (isStudyDay) {
            const focusTopic = topics[(sessionNumber - 1) % topics.length]

            const eventType =
                sessionNumber % 12 === 0
                    ? "mock"
                    : sessionNumber % 5 === 0
                        ? "quiz"
                        : sessionNumber % 3 === 0
                            ? "review"
                            : "lesson"

            const eventTitle =
                eventType === "mock"
                    ? "Mock exam checkpoint"
                    : eventType === "quiz"
                        ? "Quiz practice"
                        : eventType === "review"
                            ? `${selectedTechniqueInfo?.title ?? "Review"} session`
                            : focusTopic.title

            events.push({
                id: `event-${sessionNumber}`,
                dateKey: toDateKey(currentDate),
                title: eventTitle,
                type: eventType,
                time: studyWindow,
                /* The lesson this session is for, whatever the event is
                   titled: a "Quiz practice" session still has a topic behind
                   it, and that is what the recall paper is built against. */
                lessonId: focusTopic.lessonId ?? null,
                lessonTitle: focusTopic.title,
                /* What the scheduler fires on, and when. `at` is the machine
                   time behind `time`; `technique` is which activity to run --
                   carried per event rather than read off the plan, so a plan
                   regenerated with a different technique does not retroactively
                   change what already-finished sessions were. */
                at,
                technique,
            })

            sessionNumber += 1
            weeklyStudyCount += 1
        }

        if (day === 6) {
            if (studyDaysCount < 7) {
                events.push({
                    id: `catch-up-${toDateKey(currentDate)}`,
                    dateKey: toDateKey(currentDate),
                    title: "Weekly catch-up",
                    type: "catch-up",
                    time: studyWindow,
                    at,
                    technique,
                })
            }

            weeklyStudyCount = 0
        }

        currentDate.setDate(currentDate.getDate() + 1)
    }

    events.push({
        id: "target-exam",
        dateKey: toDateKey(examDate),
        title: "Target exam date",
        type: "mock",
        time: "Exam day",
    })

    return events
}

/**
 * Weak-topic rows reduced to unique lessons, in the order given.
 *
 * The lesson id travels with the title because the schedule is not only read by
 * people: a recall session scheduled against a topic needs to ask the server for
 * *that lesson's* questions, and a title is not something you can look a lesson
 * up by. De-duplicated on title, since the same lesson can appear under more
 * than one id across certifications.
 */
function topicRefs(rows) {
    const seen = new Set()
    const refs = []

    for (const row of Array.isArray(rows) ? rows : []) {
        const title = String(row?.lessonTitle ?? "").trim()
        if (!title || seen.has(title)) continue

        seen.add(title)
        refs.push({ lessonId: row?.lessonId ?? null, title })
    }

    return refs
}

/** Worst-first across certifications; unknown mastery sorts last, not as zero. */
function byWeakestFirst(a, b) {
    return (
        (a?.masteryPercentage ?? Number.POSITIVE_INFINITY) -
        (b?.masteryPercentage ?? Number.POSITIVE_INFINITY)
    )
}

function FormSelect({ label, value, onValueChange, options }) {
    return (
        <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
                {label}
            </Label>

            <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                    <SelectValue placeholder={label} />
                </SelectTrigger>

                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

function FormInput({ label, value, onChange, type = "text", min, max, error }) {
    return (
        <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
                {label}
            </Label>

            {/* `min`/`max` are handed to the native date picker so out-of-range
                days are unselectable rather than merely rejected afterwards.
                They are a convenience, not the guard -- a date can still be
                typed straight into the field, which is why `handleGeneratePlan`
                checks the range as well. */}
            <Input
                type={type}
                value={value}
                min={min}
                max={max}
                aria-invalid={error ? true : undefined}
                onChange={(event) => onChange(event.target.value)}
                className={`h-10 rounded-lg text-sm ${
                    error ? "border-destructive focus-visible:ring-destructive/40" : ""
                }`}
            />

            {error ? (
                <p className="text-xs font-medium text-destructive">{error}</p>
            ) : null}
        </div>
    )
}

/**
 * A study technique, as a selectable tile.
 *
 * Selection is carried by fill and a ring rather than by a border swap: with
 * every tile outlined, the selected one differed only in border colour, which
 * is the weakest signal available and left the grid reading as a wall of boxes.
 */
function TechniqueCard({ technique, selected, onSelect }) {
    const Icon = technique.icon

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`h-full rounded-2xl p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/50 hover:bg-muted"
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div
                    className={`flex size-9 items-center justify-center rounded-xl ${
                        selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground"
                    }`}
                >
                    <Icon className="size-4" />
                </div>

                {selected ? (
                    <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
                ) : null}
            </div>

            <h3 className="mt-4 text-sm font-semibold text-foreground">
                {technique.title}
            </h3>

            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {technique.description}
            </p>
        </button>
    )
}

function CalendarEvent({ event }) {
    return (
        <div
            className={`truncate rounded-md px-2 py-1 text-[11px] font-medium ring-1 ${getEventClassName(
                event.type
            )}`}
            title={`${event.title} · ${event.time}`}
        >
            {event.title}
        </div>
    )
}

function StudyPlanCalendar({
                               generatedPlan,
                               onBackToForm,
                               viewDate,
                               onPreviousMonth,
                               onNextMonth,
                           }) {
    const monthDays = useMemo(() => buildMonthDays(viewDate), [viewDate])

    const eventsByDate = useMemo(() => {
        const map = new Map()

        generatedPlan.events.forEach((event) => {
            const currentEvents = map.get(event.dateKey) ?? []
            map.set(event.dateKey, [...currentEvents, event])
        })

        return map
    }, [generatedPlan.events])

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Button variant="outline" onClick={onBackToForm} className="gap-2">
                    <ArrowLeft className="size-4" />
                    Edit Plan
                </Button>
            </div>

            <Card className="rounded-xl border-border shadow-sm">
                <CardHeader className="border-b border-border pb-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                {generatedPlan.certification}
                            </p>

                            <CardTitle className="mt-1 text-xl">
                                {formatMonthYear(viewDate)}
                            </CardTitle>

                            <CardDescription className="mt-1">
                                Study sessions, reviews, quizzes, catch-up days, and mock exam checkpoints.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={onPreviousMonth}>
                                Previous
                            </Button>

                            <Button variant="outline" size="sm" onClick={onNextMonth}>
                                Next
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                        {weekdayLabels.map((day) => (
                            <div
                                key={day}
                                className="border-r border-border px-3 py-3 text-center text-xs font-semibold text-muted-foreground last:border-r-0"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {monthDays.map((day) => {
                            const events = eventsByDate.get(day.key) ?? []

                            return (
                                <div
                                    key={day.key}
                                    className={`min-h-[132px] border-r border-b border-border p-2 last:border-r-0 ${
                                        day.isCurrentMonth ? "bg-background" : "bg-muted/20"
                                    }`}
                                >
                                    <div className="flex justify-end">
                    <span
                        className={`text-xs font-medium ${
                            day.isCurrentMonth
                                ? "text-foreground"
                                : "text-muted-foreground/50"
                        }`}
                    >
                      {day.day}
                    </span>
                                    </div>

                                    <div className="mt-2 space-y-1.5">
                                        {events.slice(0, 3).map((event) => (
                                            <CalendarEvent key={event.id} event={event} />
                                        ))}

                                        {events.length > 3 ? (
                                            <p className="px-1 text-[11px] text-muted-foreground">
                                                +{events.length - 3} more
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-4">
                <Card className="rounded-xl shadow-none">
                    <CardContent className="p-4">
                        <BookOpenCheck className="size-5 text-primary" />
                        <p className="mt-3 text-sm font-semibold">Lessons</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Main learning sessions
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl shadow-none">
                    <CardContent className="p-4">
                        <Repeat2 className="size-5 text-sky-600" />
                        <p className="mt-3 text-sm font-semibold">Reviews</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Spaced recall sessions
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl shadow-none">
                    <CardContent className="p-4">
                        <Brain className="size-5 text-blue-600" />
                        <p className="mt-3 text-sm font-semibold">Quizzes</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Practice checkpoints
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl shadow-none">
                    <CardContent className="p-4">
                        <Target className="size-5 text-amber-600" />
                        <p className="mt-3 text-sm font-semibold">Mock Exams</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Readiness checkpoints
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

/**
 * @param lockedCertification  when the generator is opened for one
 *   certification, its title -- the picker is replaced by that name, since the
 *   plan being built is for the course the learner just opened
 * @param certificationId      that certification's id, which is what the
 *   diagnostic's priority topics are read against
 * @param overall              the plan covers every enrolled certification
 *   rather than one -- there is no course to pick, and the priority topics are
 *   pooled from every certification's diagnostic instead of one certification's
 * @param generating           whether the parent is still saving the plan
 */
export function StudyPlanContent({
    onPlanGenerated,
    lockedCertification,
    certificationId,
    overall = false,
    generating = false,
}) {
    const { data } = useOutletContext()

    const certificationOptions = useMemo(
        () => (data?.certifications ?? [])
            .map((item) => item?.title)
            .filter(Boolean),
        [data?.certifications]
    )

    /* Which certifications an overall plan covers. Null means "not chosen yet",
       which reads as all of them -- a learner who opens the generator and
       changes nothing gets a plan over everything they are enrolled in, and
       only a deliberate uncheck narrows it. Derived rather than seeded through
       an effect so a certification arriving late is covered by that default
       instead of being missed by a one-shot initialisation. */
    const [chosenCertificationIds, setChosenCertificationIds] = useState(null)

    const enrolledCertifications = useMemo(() => {
        if (!overall) {
            return []
        }
        const rows = data?.enrolledCertifications ?? data?.certifications ?? []
        return rows
            .filter((row) => row?.certificationId != null)
            .map((row) => ({
                id: String(row.certificationId),
                title: row?.title ?? "Untitled Certification",
            }))
    }, [overall, data?.enrolledCertifications, data?.certifications])

    const selectedCertificationIds = useMemo(() => {
        const enrolledIds = enrolledCertifications.map((row) => row.id)
        if (chosenCertificationIds == null) {
            return enrolledIds
        }
        // Filtered against what is currently enrolled: a certification the
        // learner leaves while the dialog is open must not stay in the plan.
        const enrolled = new Set(enrolledIds)
        return chosenCertificationIds.filter((id) => enrolled.has(id))
    }, [enrolledCertifications, chosenCertificationIds])

    function toggleCertification(id) {
        setChosenCertificationIds((current) => {
            const base = current ?? enrolledCertifications.map((row) => row.id)
            return base.includes(id)
                ? base.filter((selected) => selected !== id)
                : [...base, id]
        })
    }

    /* When each certification is studied. Certifications are not sat on the
       same day, so one shared exam date would schedule every one of them
       backwards from whichever exam happens to be last -- the nearer exams
       would get a calendar that runs long past them. Each carries its own
       window, and the schedule for each is built between its own two dates.

       Held only for the ones the learner has actually edited; the rest fall
       back to the shared defaults below, so a plan can still be generated
       without touching a single date field. */
    const [certificationDates, setCertificationDates] = useState({})

    function datesFor(id) {
        return certificationDates[id] ?? { calendarStart, targetExamDate }
    }

    function setCertificationDate(id, field, value) {
        setCertificationDates((current) => ({
            ...current,
            [id]: { ...(current[id] ?? { calendarStart, targetExamDate }), [field]: value },
        }))
    }

    /** A certification whose calendar would start after its own exam. */
    function certificationDatesOutOfOrder(id) {
        const { calendarStart: from, targetExamDate: to } = datesFor(id)
        return Boolean(from) && Boolean(to) && from > to
    }

    /* What the plan is called wherever a course title would go. "All
       certifications" only when it really is all of them -- saying that over a
       narrowed selection would misdescribe the plan on the calendar it is
       saved to. */
    const overallCertificationLabel = useMemo(() => {
        if (!overall) {
            return null
        }
        const count = selectedCertificationIds.length
        if (count === 0) {
            return "No certifications selected"
        }
        if (count === enrolledCertifications.length) {
            return OVERALL_CERTIFICATION_LABEL
        }
        if (count === 1) {
            return enrolledCertifications.find((row) => row.id === selectedCertificationIds[0])?.title
                ?? "1 certification"
        }
        return `${count} certifications`
    }, [overall, selectedCertificationIds, enrolledCertifications])

    /* Either kind of fixed heading: the course the generator was opened for, or
       the chosen set for an overall plan. Both replace the single-course picker
       -- in the first case the course is already decided, and in the second the
       plan spans more than one. */
    const certificationLabel = overall
        ? overallCertificationLabel
        : lockedCertification

    const [certification, setCertification] = useState(certificationLabel ?? "")
    const [courseGoal, setCourseGoal] = useState("Complete a full reviewer")
    // Dated from today rather than from fixed literals. The defaults used to be
    // hardcoded calendar dates, which quietly went stale -- a plan whose first
    // study block is already in the past schedules nothing the learner can do.
    const [targetExamDate, setTargetExamDate] = useState(() => toDateKey(addDays(new Date(), 90)))
    const [targetReadiness, setTargetReadiness] = useState(readinessOptions[1])
    const [examPriority, setExamPriority] = useState(priorityOptions[0])
    const [calendarStart, setCalendarStart] = useState(() => toDateKey(new Date()))
    const [studyDays, setStudyDays] = useState(studyDaysOptions[2])
    const [studyWindow, setStudyWindow] = useState(studyWindowOptions[2])
    const [selectedTechnique, setSelectedTechnique] = useState("spaced-repetition")
    const [studyPreferences, setStudyPreferences] = useState("")
    const [generatedPlan, setGeneratedPlan] = useState(null)
    const [viewDate, setViewDate] = useState(() => new Date())

    useEffect(() => {
        if (certificationLabel) {
            setCertification(certificationLabel)
            return
        }
        if (!certificationOptions.includes(certification)) {
            setCertification(certificationOptions[0] ?? "")
        }
    }, [certification, certificationOptions, certificationLabel])

    /**
     * The topics the diagnostic says to study first.
     *
     * From the certification's progress analytics, which is where the
     * diagnostic's result actually lands: the BKT service turns the attempt
     * into a per-lesson mastery probability and priority tag, and
     * `weakestTopics` is that list already sorted worst-first. This used to
     * rummage through the portal payload for a dozen speculative field names
     * (`weakTopics`, `diagnosticResult.weakLessons`, ...) that nothing ever
     * sets, so it came back empty no matter how many diagnostics were sat.
     */
    const analyticsQuery = useQuery({
        queryKey: progressAnalyticsQueryKey(String(certificationId ?? "")),
        queryFn: () => getProgressAnalytics(certificationId),
        enabled: !overall && Boolean(certificationId),
        staleTime: 60_000,
    })

    /* An overall plan asks the same question of every certification it covers.
       There is no cross-certification analytics endpoint -- analytics is scoped
       to one certification by design -- so this fans out over the chosen ones.
       The keys are the shared ones, so the certification the analytics board is
       already showing is answered from cache rather than fetched a second time.

       Following the selection rather than the enrolment means unchecking a
       certification takes its topics out of the plan, which is the whole point
       of choosing: the schedule is built from these topics.

       Reduced inside `combine` rather than in a `useMemo` afterwards: the array
       `useQueries` returns is a fresh one on every render, so a memo keyed on it
       would recompute every time regardless and only look memoized. */
    const overallPriorities = useQueries({
        queries: selectedCertificationIds.map((id) => ({
            queryKey: progressAnalyticsQueryKey(id),
            queryFn: () => getProgressAnalytics(id),
            staleTime: 60_000,
        })),
        combine: (results) => {
            /* Kept per certification as well as pooled. Each certification is
               scheduled over its own dates, so its sessions have to be built
               from its own weak topics -- a pooled rotation would drop another
               certification's lessons into this one's study window.

               Zipped by position: `useQueries` returns results in the order the
               queries were given, which is the order of the selected ids. */
            const byCertification = {}
            results.forEach((result, index) => {
                const id = selectedCertificationIds[index]
                if (id != null) {
                    byCertification[id] = topicRefs(result.data?.weakestTopics)
                }
            })

            return {
                byCertification,

                /* The pooled view, for the priority-topics section: one list of
                   what to work on first across the whole plan. Re-sorted because
                   concatenating sorted lists does not give a sorted one -- the
                   order would otherwise follow whichever certification answered
                   first, so a strong topic from one could outrank a critical
                   topic from another. */
                topics: topicRefs(
                    results
                        .flatMap((result) =>
                            Array.isArray(result.data?.weakestTopics)
                                ? result.data.weakestTopics
                                : []
                        )
                        .sort(byWeakestFirst)
                ).slice(0, OVERALL_PRIORITY_TOPIC_LIMIT),

                /* One certification still computing is enough to call the whole
                   pool pending: the topics on screen are not yet the worst ones
                   overall, they are the worst of whatever has answered so far. */
                pending: results.some(
                    (result) => result.isLoading || result.data?.bktAvailable === false
                ),
            }
        },
    })

    const singleCertificationTopics = useMemo(() => {
        const rows = analyticsQuery.data?.weakestTopics
        return [
            ...new Set(
                (Array.isArray(rows) ? rows : [])
                    .map((row) => String(row?.lessonTitle ?? "").trim())
                    .filter(Boolean)
            ),
        ]
    }, [analyticsQuery.data])

    const priorityTopics = overall ? overallPriorities.topics : singleCertificationTopics

    // Told apart so the empty state can say which it is: mastery still being
    // computed is a wait, no certification is a different situation entirely.
    const priorityTopicsPending = overall
        ? overallPriorities.pending
        : Boolean(certificationId) &&
          (analyticsQuery.isLoading || analyticsQuery.data?.bktAvailable === false)

    const selectedTechniqueInfo = useMemo(() => {
        return studyTechniques.find((item) => item.id === selectedTechnique)
    }, [selectedTechnique])

    /* The calendar has to begin before the exam it is preparing for. Compared
       as plain YYYY-MM-DD strings: both come from date inputs in that format,
       so lexicographic order is chronological and there is no timezone to get
       wrong. Equal dates are allowed -- a single-day crash plan is odd, but it
       is not incoherent. */
    const datesOutOfOrder = overall
        ? selectedCertificationIds.some(certificationDatesOutOfOrder)
        : Boolean(calendarStart) && Boolean(targetExamDate) && calendarStart > targetExamDate

    /* A plan over nothing is not a plan: the schedule is built from the chosen
       certifications' weak topics, so with none chosen the generator would fall
       back to its generic placeholder topic and produce a calendar that names
       no actual lesson. */
    const noCertificationsSelected = overall && selectedCertificationIds.length === 0

    /* The preview's one date. An overall plan has several, so it shows the last
       of them -- when the whole plan is done -- rather than the shared field,
       which is hidden in that mode and would report a date nothing uses. */
    const previewExamDate = overall
        ? selectedCertificationIds
              .map((id) => datesFor(id).targetExamDate)
              .filter(Boolean)
              .reduce((latest, value) => (value > latest ? value : latest), "") || "—"
        : targetExamDate

    function handleGeneratePlan() {
        if (noCertificationsSelected) {
            return
        }

        // Belt and braces alongside the pickers' own min/max: a date typed
        // directly into the field bypasses those entirely, and a calendar
        // starting after the exam produces a plan with no study days at all --
        // `generateStudyEvents` loops `while (currentDate <= examDate)`, which
        // never runs, leaving only the target-exam marker.
        if (datesOutOfOrder) {
            return
        }

        /* One schedule per certification, over that certification's own dates
           and from its own weak topics, then merged. Generating once over a
           shared window would prepare every certification for whichever exam
           sits last, which is wrong for all the earlier ones. */
        const certificationPlans = overall
            ? selectedCertificationIds.map((id) => ({
                  certificationId: Number(id),
                  title:
                      enrolledCertifications.find((row) => row.id === id)?.title
                      ?? "Untitled Certification",
                  ...datesFor(id),
              }))
            : []

        const events = overall
            ? certificationPlans.flatMap((entry) =>
                  generateStudyEvents({
                      calendarStart: entry.calendarStart,
                      targetExamDate: entry.targetExamDate,
                      studyDays,
                      studyWindow,
                      selectedTechniqueInfo,
                      priorityTopics:
                          overallPriorities.byCertification[String(entry.certificationId)] ?? [],
                  }).map((event) => ({
                      ...event,
                      /* Namespaced: the generator numbers events from one per
                         schedule, so without this every certification would
                         contribute an "event-1" and React would see duplicate
                         keys on the calendar. */
                      id: `${entry.certificationId}-${event.id}`,
                      certificationId: entry.certificationId,
                      certification: entry.title,
                  }))
              )
            : generateStudyEvents({
                  calendarStart,
                  targetExamDate,
                  studyDays,
                  studyWindow,
                  selectedTechniqueInfo,
                  priorityTopics,
              })

        /* The plan's outer span. For an overall plan that is the earliest start
           and the latest exam across its certifications -- what the study
           calendar prints as the range, and what the countdown falls back to
           when it cannot find the certification's own entry. */
        const planCalendarStart = overall
            ? certificationPlans
                  .map((entry) => entry.calendarStart)
                  .filter(Boolean)
                  .reduce((earliest, value) => (value < earliest ? value : earliest), calendarStart)
            : calendarStart

        const planTargetExamDate = overall
            ? certificationPlans
                  .map((entry) => entry.targetExamDate)
                  .filter(Boolean)
                  .reduce((latest, value) => (value > latest ? value : latest), targetExamDate)
            : targetExamDate

        const nextPlan = {
            certification,
            /* Which certifications the plan covers and when each is studied,
               carried in the schedule itself. The row has one nullable
               certificationId, which cannot hold a set -- and the schedule is
               already where everything else about a plan lives, so this
               survives a reload with it and needs no schema change. Numbers, to
               match the ids everything else compares against. */
            ...(overall
                ? {
                      certificationIds: selectedCertificationIds.map(Number),
                      certificationPlans,
                  }
                : null),
            courseGoal,
            targetExamDate: planTargetExamDate,
            targetReadiness,
            examPriority,
            calendarStart: planCalendarStart,
            studyDays,
            studyWindow,
            selectedTechniqueInfo,
            priorityTopics,
            studyPreferences,
            events,
        }

        if (onPlanGenerated) {
            onPlanGenerated(nextPlan)
        } else {
            setGeneratedPlan(nextPlan)
        }

        setViewDate(parseDate(planCalendarStart))
    }

    function handlePreviousMonth() {
        setViewDate((currentDate) => {
            const nextDate = new Date(currentDate)
            nextDate.setMonth(currentDate.getMonth() - 1)
            return nextDate
        })
    }

    function handleNextMonth() {
        setViewDate((currentDate) => {
            const nextDate = new Date(currentDate)
            nextDate.setMonth(currentDate.getMonth() + 1)
            return nextDate
        })
    }

    if (generatedPlan) {
        return (
            <StudyPlanCalendar
                generatedPlan={generatedPlan}
                viewDate={viewDate}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                onBackToForm={() => setGeneratedPlan(null)}
            />
        )
    }

    return (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
            {/* Left: the form, as flat sections separated by space rather than
                by nested bordered cards. The old markup put a Card inside a
                Card inside a bordered section, so every group announced itself
                with an outline and nothing read as more important than
                anything else. */}
            <main className="min-w-0 space-y-8">
                <section>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Course and target
                    </p>

                    {/* Its own full-width block rather than a cell in the grid
                        below: this is a list that grows with the learner's
                        enrolments, and squeezed into a half-width column it
                        would scroll inside a box the size of a text input. */}
                    {overall ? (
                        <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <Label className="text-xs font-semibold text-foreground">
                                    Certifications to cover
                                </Label>

                                <p className="text-xs text-muted-foreground">
                                    {noCertificationsSelected
                                        ? "Pick at least one"
                                        : `${selectedCertificationIds.length} of ${enrolledCertifications.length} selected`}
                                </p>
                            </div>

                            {enrolledCertifications.length === 0 ? (
                                <p className="rounded-2xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                                    You are not enrolled in any certifications yet, so there is
                                    nothing to build a plan around.
                                </p>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {enrolledCertifications.map((row) => {
                                        const checked = selectedCertificationIds.includes(row.id)
                                        const dates = datesFor(row.id)
                                        const outOfOrder = checked && certificationDatesOutOfOrder(row.id)

                                        return (
                                            <div
                                                key={row.id}
                                                className={`rounded-2xl p-3 transition ${
                                                    checked
                                                        ? "bg-primary/10 ring-2 ring-primary"
                                                        : "bg-muted/50 hover:bg-muted"
                                                }`}
                                            >
                                                {/* The whole row is the label, so the
                                                    title is part of the hit area rather
                                                    than the 24px box being the only way
                                                    to tick one. */}
                                                <Label
                                                    htmlFor={`study-plan-certification-${row.id}`}
                                                    className="flex cursor-pointer items-center gap-3 text-sm font-medium"
                                                >
                                                    <Checkbox
                                                        id={`study-plan-certification-${row.id}`}
                                                        checked={checked}
                                                        onCheckedChange={() => toggleCertification(row.id)}
                                                    />

                                                    <span className="min-w-0 leading-snug">{row.title}</span>
                                                </Label>

                                                {/* Shown on ticking rather than always:
                                                    dates for a certification the plan
                                                    does not cover are two fields that
                                                    change nothing, and every enrolment
                                                    carrying them would bury the choice
                                                    itself under a wall of date pickers. */}
                                                {checked ? (
                                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                        <FormInput
                                                            label="Starts"
                                                            value={dates.calendarStart}
                                                            onChange={(value) =>
                                                                setCertificationDate(row.id, "calendarStart", value)
                                                            }
                                                            type="date"
                                                            max={dates.targetExamDate || undefined}
                                                            error={
                                                                outOfOrder
                                                                    ? "Start on or before the exam."
                                                                    : undefined
                                                            }
                                                        />

                                                        <FormInput
                                                            label="Target exam date"
                                                            value={dates.targetExamDate}
                                                            onChange={(value) =>
                                                                setCertificationDate(row.id, "targetExamDate", value)
                                                            }
                                                            type="date"
                                                            min={dates.calendarStart || undefined}
                                                            error={
                                                                outOfOrder
                                                                    ? "The exam is before the start."
                                                                    : undefined
                                                            }
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {/* An overall plan has already said which certifications
                            it covers, above. */}
                        {overall ? null : lockedCertification ? (
                            // Opened for one certification: the course is decided,
                            // and a picker would only offer a way to plan the wrong one.
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-foreground">
                                    Certification
                                </Label>

                                <p className="flex h-10 items-center rounded-lg bg-muted px-3 text-sm font-medium text-foreground">
                                    {lockedCertification}
                                </p>
                            </div>
                        ) : (
                            <FormSelect
                                label="Certification"
                                value={certification}
                                onValueChange={setCertification}
                                options={certificationOptions}
                            />
                        )}

                        <FormInput
                            label="Course goal"
                            value={courseGoal}
                            onChange={setCourseGoal}
                        />

                        {/* Per certification for an overall plan, up in the
                            selection above -- each exam is sat on its own day. */}
                        {overall ? null : (
                            <FormInput
                                label="Target exam date"
                                value={targetExamDate}
                                onChange={setTargetExamDate}
                                type="date"
                                min={calendarStart || undefined}
                                error={
                                    datesOutOfOrder
                                        ? "The exam date is before the calendar starts."
                                        : undefined
                                }
                            />
                        )}

                        <FormSelect
                            label="Target readiness"
                            value={targetReadiness}
                            onValueChange={setTargetReadiness}
                            options={readinessOptions}
                        />

                        <FormSelect
                            label="Exam priority"
                            value={examPriority}
                            onValueChange={setExamPriority}
                            options={priorityOptions}
                        />
                    </div>
                </section>

                <section>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Schedule
                    </p>

                    {/* "Preferred study window" used to appear up in the section
                        above as well, both controls bound to the same state --
                        two inputs for one value, which is a bug however it is
                        laid out. It lives here, with the rest of the timing. */}
                    <div className={`mt-4 grid gap-4 ${overall ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                        {/* Also per certification for an overall plan: each one
                            starts when the learner means to begin it. Study days
                            and the preferred hour stay shared -- those describe
                            the learner's week, not any one course. */}
                        {overall ? null : (
                            <FormInput
                                label="Calendar starts"
                                value={calendarStart}
                                onChange={setCalendarStart}
                                type="date"
                                max={targetExamDate || undefined}
                                error={
                                    datesOutOfOrder
                                        ? "Start the calendar on or before your exam date."
                                        : undefined
                                }
                            />
                        )}

                        <FormSelect
                            label="Study days per week"
                            value={studyDays}
                            onValueChange={setStudyDays}
                            options={studyDaysOptions}
                        />

                        <FormSelect
                            label="Preferred study time"
                            value={studyWindow}
                            onValueChange={setStudyWindow}
                            options={studyWindowOptions}
                        />
                    </div>
                </section>

                <section>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Study technique
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {studyTechniques.map((technique) => (
                            <TechniqueCard
                                key={technique.id}
                                technique={technique}
                                selected={selectedTechnique === technique.id}
                                onSelect={() => setSelectedTechnique(technique.id)}
                            />
                        ))}
                    </div>
                </section>

                <section>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Priority topics
                        </p>

                        <p className="text-xs text-muted-foreground">
                            {overall
                                ? "Weakest across every certification"
                                : "From your diagnostic"}
                        </p>
                    </div>

                    {priorityTopics.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {priorityTopics.map((topic) => (
                                <Badge
                                    key={topic.title}
                                    variant="secondary"
                                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                                >
                                    {topic.title}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-4 rounded-2xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                            {priorityTopicsPending
                                ? "Working out which topics to put first from your diagnostic. This takes a moment."
                                : overall
                                    ? "Your weak topics appear here once you have submitted a diagnostic on at least one certification."
                                    : "Your weak topics appear here once the diagnostic is submitted."}
                        </p>
                    )}
                </section>

                <section>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Anything else
                    </p>

                    <Textarea
                        value={studyPreferences}
                        onChange={(event) => setStudyPreferences(event.target.value)}
                        maxLength={500}
                        placeholder="Example: I am available Monday, Wednesday, and Friday after 7 PM. Use short sessions with breaks and add one catch-up day every week."
                        className="mt-4 min-h-28 resize-none rounded-2xl border-transparent bg-muted/50 focus-visible:bg-background"
                    />

                    <p className="mt-2 text-right text-xs text-muted-foreground">
                        {studyPreferences.length} / 500
                    </p>
                </section>

                {/* One action, at the end of the form it completes. There were
                    two "generate" buttons doing the same thing, and a "Save as
                    draft" beside them that was wired to nothing at all. */}
                <div className="flex justify-end">
                    <Button
                        className="gap-2"
                        onClick={handleGeneratePlan}
                        disabled={generating || datesOutOfOrder || noCertificationsSelected}
                    >
                        {generating ? (
                            "Saving plan…"
                        ) : (
                            <>
                                <Sparkles className="size-4" />
                                Generate calendar
                            </>
                        )}
                    </Button>
                </div>
            </main>

            {/* Right: what the plan currently amounts to, updating as the form
                is filled. Sticky, so it stays readable while the form scrolls. */}
            <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
                <div className="rounded-2xl bg-muted/50 p-5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <ListChecks className="size-4" aria-hidden="true" />

                        <p className="text-xs font-semibold uppercase tracking-wider">
                            Preview
                        </p>
                    </div>

                    <p className="mt-4 font-semibold leading-snug text-foreground">
                        {certification || "Your certification"}
                    </p>

                    <dl className="mt-4 space-y-3 text-sm">
                        {[
                            [Clock3, "Study days", studyDays],
                            [CalendarDays, overall ? "Last exam" : "Exam date", previewExamDate],
                            [Brain, "Technique", selectedTechniqueInfo?.title],
                            [Target, "Readiness", targetReadiness],
                        ].map(([Icon, label, value]) => (
                            <div key={label} className="flex items-start gap-2.5">
                                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />

                                <div className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">{label}</dt>
                                    <dd className="font-medium text-foreground">{value}</dd>
                                </div>
                            </div>
                        ))}
                    </dl>

                    {priorityTopics.length > 0 ? (
                        <div className="mt-5 border-t border-border/60 pt-4">
                            <p className="text-xs text-muted-foreground">Focus first</p>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {priorityTopics.slice(0, 4).map((topic) => (
                                    <Badge key={topic.title} variant="secondary" className="rounded-full">
                                        {topic.title}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </aside>
        </div>
    )
}

/**
 * No premium guard: the study plan is part of the study flow every learner
 * goes through after their diagnostic, not an upsell. Gating it meant a Free
 * learner clicked "Continue", got nothing, and had no way to know why.
 */
export function StudyPlanGenerator({
    onPlanGenerated,
    lockedCertification,
    certificationId,
    overall,
    generating,
}) {
    return (
        <StudyPlanContent
            onPlanGenerated={onPlanGenerated}
            lockedCertification={lockedCertification}
            certificationId={certificationId}
            overall={overall}
            generating={generating}
        />
    )
}

export default function LearningStudyPlan() {
    return <StudyPlanGenerator />
}
