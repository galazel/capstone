import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"
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
    {
        id: "feynman",
        title: "Feynman Technique",
        description:
            "Explain the topic in simple words to check if you truly understand it.",
        icon: BookOpenCheck,
    },
    {
        id: "time-blocking",
        title: "Time Blocking",
        description:
            "Reserve fixed study blocks for lessons, quizzes, and mock exams.",
        icon: CalendarDays,
    },
    {
        id: "adaptive-mix",
        title: "Adaptive Mix",
        description:
            "Let REBYU combine methods based on weak topics, quiz scores, and target date.",
        icon: Sparkles,
    },
]

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

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
    const startDate = parseDate(calendarStart)
    const examDate = parseDate(targetExamDate)
    const studyDaysCount = getStudyDaysCount(studyDays)

    const topics =
        Array.isArray(priorityTopics) && priorityTopics.length > 0
            ? priorityTopics
            : ["Core certification lesson"]

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
                            : focusTopic

            events.push({
                id: `event-${sessionNumber}`,
                dateKey: toDateKey(currentDate),
                title: eventTitle,
                type: eventType,
                time: studyWindow,
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
 * @param generating           whether the parent is still saving the plan
 */
export function StudyPlanContent({
    onPlanGenerated,
    lockedCertification,
    certificationId,
    generating = false,
}) {
    const { data } = useOutletContext()

    const certificationOptions = useMemo(
        () => (data?.certifications ?? [])
            .map((item) => item?.title)
            .filter(Boolean),
        [data?.certifications]
    )

    const [certification, setCertification] = useState(lockedCertification ?? "")
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
        if (lockedCertification) {
            setCertification(lockedCertification)
            return
        }
        if (!certificationOptions.includes(certification)) {
            setCertification(certificationOptions[0] ?? "")
        }
    }, [certification, certificationOptions, lockedCertification])

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
        queryKey: ["learner-progress-analytics", String(certificationId ?? "")],
        queryFn: () => getProgressAnalytics(certificationId),
        enabled: Boolean(certificationId),
        staleTime: 60_000,
    })

    const priorityTopics = useMemo(() => {
        const rows = analyticsQuery.data?.weakestTopics
        return [
            ...new Set(
                (Array.isArray(rows) ? rows : [])
                    .map((row) => String(row?.lessonTitle ?? "").trim())
                    .filter(Boolean)
            ),
        ]
    }, [analyticsQuery.data])

    // Told apart so the empty state can say which it is: mastery still being
    // computed is a wait, no certification is a different situation entirely.
    const priorityTopicsPending =
        Boolean(certificationId) &&
        (analyticsQuery.isLoading || analyticsQuery.data?.bktAvailable === false)

    const selectedTechniqueInfo = useMemo(() => {
        return studyTechniques.find((item) => item.id === selectedTechnique)
    }, [selectedTechnique])

    /* The calendar has to begin before the exam it is preparing for. Compared
       as plain YYYY-MM-DD strings: both come from date inputs in that format,
       so lexicographic order is chronological and there is no timezone to get
       wrong. Equal dates are allowed -- a single-day crash plan is odd, but it
       is not incoherent. */
    const datesOutOfOrder =
        Boolean(calendarStart) && Boolean(targetExamDate) && calendarStart > targetExamDate

    function handleGeneratePlan() {
        // Belt and braces alongside the pickers' own min/max: a date typed
        // directly into the field bypasses those entirely, and a calendar
        // starting after the exam produces a plan with no study days at all --
        // `generateStudyEvents` loops `while (currentDate <= examDate)`, which
        // never runs, leaving only the target-exam marker.
        if (datesOutOfOrder) {
            return
        }

        const events = generateStudyEvents({
            calendarStart,
            targetExamDate,
            studyDays,
            studyWindow,
            selectedTechniqueInfo,
            priorityTopics,
        })

        const nextPlan = {
            certification,
            courseGoal,
            targetExamDate,
            targetReadiness,
            examPriority,
            calendarStart,
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

        setViewDate(parseDate(calendarStart))
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

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {lockedCertification ? (
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
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
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

                        <p className="text-xs text-muted-foreground">From your diagnostic</p>
                    </div>

                    {priorityTopics.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {priorityTopics.map((topic) => (
                                <Badge
                                    key={topic}
                                    variant="secondary"
                                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                                >
                                    {topic}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-4 rounded-2xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                            {priorityTopicsPending
                                ? "Working out which topics to put first from your diagnostic. This takes a moment."
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
                        disabled={generating || datesOutOfOrder}
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
                            [CalendarDays, "Exam date", targetExamDate],
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
                                    <Badge key={topic} variant="secondary" className="rounded-full">
                                        {topic}
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
    generating,
}) {
    return (
        <StudyPlanContent
            onPlanGenerated={onPlanGenerated}
            lockedCertification={lockedCertification}
            certificationId={certificationId}
            generating={generating}
        />
    )
}

export default function LearningStudyPlan() {
    return <StudyPlanGenerator />
}
