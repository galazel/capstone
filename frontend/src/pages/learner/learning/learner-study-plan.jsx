import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
    ArrowLeft,
    ArrowRight,
    BookOpenCheck,
    Brain,
    CalendarCheck,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Layers3,
    ListChecks,
    Repeat2,
    Sparkles,
    Target,
    TimerReset,
    Zap,
} from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import LearnerPremiumGuard from "@/components/learner/learner-premium-guard.jsx"

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

function collectArrays(...sources) {
    return sources.flatMap((source) => (Array.isArray(source) ? source : []))
}

function getTopicName(topic) {
    return (
        topic?.topicName ??
        topic?.lessonName ??
        topic?.categoryName ??
        topic?.middleCategoryTitle ??
        topic?.middleCategoryName ??
        topic?.majorCategoryTitle ??
        topic?.title ??
        topic?.name ??
        topic
    )
}

function getDiagnosticPriorityTopics(data) {
    const directTopics = collectArrays(
        data?.diagnosticPriorityTopics,
        data?.priorityTopics,
        data?.weakTopics,
        data?.weakLessons,
        data?.diagnosticWeakTopics,
        data?.latestDiagnosticResult?.priorityTopics,
        data?.latestDiagnosticResult?.weakTopics,
        data?.latestDiagnosticResult?.weakLessons,
        data?.diagnosticResult?.priorityTopics,
        data?.diagnosticResult?.weakTopics,
        data?.diagnosticResult?.weakLessons
    )

    const resultSources = collectArrays(
        data?.assessmentResults,
        data?.examResults,
        data?.diagnosticResults,
        data?.learnerExamResults
    )

    const resultTopics = resultSources.flatMap((result) => {
        const typeText = String(
            result?.assessmentType ??
            result?.assessmentTypeText ??
            result?.examType ??
            result?.examTypeText ??
            result?.type ??
            result?.title ??
            result?.examName ??
            ""
        ).toLowerCase()

        const isDiagnostic = typeText.includes("diagnostic")

        if (!isDiagnostic) {
            return []
        }

        return collectArrays(
            result?.priorityTopics,
            result?.weakTopics,
            result?.weakLessons,
            result?.topicResults,
            result?.lessonResults
        )
    })

    return [
        ...new Set(
            [...directTopics, ...resultTopics]
                .map((topic) => String(getTopicName(topic) ?? "").trim())
                .filter(Boolean)
        ),
    ]
}

function parseDate(value) {
    return new Date(`${value}T00:00:00`)
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

function FormInput({ label, value, onChange, type = "text" }) {
    return (
        <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
                {label}
            </Label>

            <Input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 rounded-lg text-sm"
            />
        </div>
    )
}

function TechniqueCard({ technique, selected, onSelect }) {
    const Icon = technique.icon

    return (
        <button type="button" onClick={onSelect} className="h-full text-left">
            <Card
                className={`h-full min-h-[145px] rounded-xl border shadow-none transition hover:border-primary/40 hover:bg-muted/30 ${
                    selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                        : "border-border bg-card"
                }`}
            >
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div
                            className={`flex size-9 items-center justify-center rounded-lg ${
                                selected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                            }`}
                        >
                            <Icon className="size-4" />
                        </div>

                        <div
                            className={`flex size-5 items-center justify-center rounded-full border ${
                                selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background"
                            }`}
                        >
                            {selected ? <CheckCircle2 className="size-4" /> : null}
                        </div>
                    </div>

                    <h3 className="mt-4 text-sm font-semibold text-foreground">
                        {technique.title}
                    </h3>

                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {technique.description}
                    </p>
                </CardContent>
            </Card>
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

export function StudyPlanContent({ onPlanGenerated }) {
    const { data } = useOutletContext()

    const certificationOptions = useMemo(
        () => (data?.certifications ?? [])
            .map((item) => item?.title)
            .filter(Boolean),
        [data?.certifications]
    )

    const [certification, setCertification] = useState("")
    const [courseGoal, setCourseGoal] = useState("Complete a full reviewer")
    const [targetExamDate, setTargetExamDate] = useState("2026-11-08")
    const [targetReadiness, setTargetReadiness] = useState(readinessOptions[1])
    const [examPriority, setExamPriority] = useState(priorityOptions[0])
    const [calendarStart, setCalendarStart] = useState("2026-07-06")
    const [studyDays, setStudyDays] = useState(studyDaysOptions[2])
    const [studyWindow, setStudyWindow] = useState(studyWindowOptions[2])
    const [selectedTechnique, setSelectedTechnique] = useState("spaced-repetition")
    const [studyPreferences, setStudyPreferences] = useState("")
    const [generatedPlan, setGeneratedPlan] = useState(null)
    const [viewDate, setViewDate] = useState(() => parseDate("2026-07-06"))

    useEffect(() => {
        if (!certificationOptions.includes(certification)) {
            setCertification(certificationOptions[0] ?? "")
        }
    }, [certification, certificationOptions])

    const priorityTopics = useMemo(() => {
        return getDiagnosticPriorityTopics(data)
    }, [data])

    const selectedTechniqueInfo = useMemo(() => {
        return studyTechniques.find((item) => item.id === selectedTechnique)
    }, [selectedTechnique])

    function handleGeneratePlan() {
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
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Button className="gap-2" onClick={handleGeneratePlan}>
                    <Sparkles className="size-4" />
                    Generate Calendar
                </Button>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <main className="min-w-0">
                    <Card className="rounded-xl border-border shadow-sm">
                        <CardHeader className="border-b border-border pb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Target className="size-5" />
                                </div>

                                <div>
                                    <CardTitle className="text-base">
                                        Course, target exam, and calendar schedule
                                    </CardTitle>

                                    <CardDescription>
                                        Calendar generation is required for every REBYU study plan.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6 p-5">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <FormSelect
                                    label="Certification"
                                    value={certification}
                                    onValueChange={setCertification}
                                    options={certificationOptions}
                                />

                                <FormInput
                                    label="Course goal"
                                    value={courseGoal}
                                    onChange={setCourseGoal}
                                />

                                <FormSelect
                                    label="Exam priority"
                                    value={examPriority}
                                    onValueChange={setExamPriority}
                                    options={priorityOptions}
                                />

                                <FormInput
                                    label="Target exam date"
                                    value={targetExamDate}
                                    onChange={setTargetExamDate}
                                    type="date"
                                />

                                <FormSelect
                                    label="Target readiness"
                                    value={targetReadiness}
                                    onValueChange={setTargetReadiness}
                                    options={readinessOptions}
                                />

                                <FormSelect
                                    label="Preferred study window"
                                    value={studyWindow}
                                    onValueChange={setStudyWindow}
                                    options={studyWindowOptions}
                                />
                            </div>

                            <Separator />

                            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                                <div className="flex items-start gap-3">
                                    <CalendarCheck className="mt-0.5 size-5 shrink-0 text-primary" />

                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">
                                            Calendar schedule is required
                                        </h3>

                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            After creating a study plan, this page will show a full calendar
                                            with lessons, reviews, quizzes, catch-up days, and mock exam checkpoints.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                    <FormInput
                                        label="Calendar starts"
                                        value={calendarStart}
                                        onChange={setCalendarStart}
                                        type="date"
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

                            <Separator />

                            <section>
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Brain className="size-5" />
                                    </div>

                                    <div>
                                        <h2 className="text-base font-semibold text-foreground">
                                            Choose your study technique
                                        </h2>

                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Select how REBYU should structure your review.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                    {studyTechniques.map((technique) => (
                                        <TechniqueCard
                                            key={technique.id}
                                            technique={technique}
                                            selected={selectedTechnique === technique.id}
                                            onSelect={() => setSelectedTechnique(technique.id)}
                                        />
                                    ))}
                                </div>

                                <div className="mt-5 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-6 text-primary">
                  <span className="font-semibold">
                    {selectedTechniqueInfo?.title}:
                  </span>{" "}
                                    REBYU will organize your study flow using this method and connect it
                                    with quizzes, weak-topic practice, and mock exam checkpoints.
                                </div>
                            </section>

                            <Separator />

                            <section>
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                        <Layers3 className="size-5" />
                                    </div>

                                    <div>
                                        <h2 className="text-base font-semibold text-foreground">
                                            Priority Topics
                                        </h2>

                                        <p className="mt-1 text-sm text-muted-foreground">
                                            These topics are automatically generated from your diagnostic exam result.
                                        </p>
                                    </div>
                                </div>

                                <Card className="mt-5 rounded-xl border-border bg-muted/30 shadow-none">
                                    <CardContent className="p-4">
                                        {priorityTopics.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
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
                                            <div className="rounded-lg border border-dashed border-border bg-background p-4">
                                                <p className="text-sm font-medium text-foreground">
                                                    No priority topics yet
                                                </p>

                                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                    Take the diagnostic exam first. After submission, REBYU will display
                                                    your weak topics here automatically.
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="mt-5 rounded-xl border-border shadow-none">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <CalendarCheck className="mt-1 size-5 shrink-0 text-primary" />

                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-semibold text-foreground">
                                                    Study plan preferences
                                                </h3>

                                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                    Add optional notes such as rest days, short sessions, review style,
                                                    or school schedule.
                                                </p>

                                                <Textarea
                                                    value={studyPreferences}
                                                    onChange={(event) =>
                                                        setStudyPreferences(event.target.value)
                                                    }
                                                    maxLength={500}
                                                    placeholder="Example: I am available Monday, Wednesday, and Friday after 7 PM. Use short sessions with breaks and add one catch-up day every week."
                                                    className="mt-4 min-h-[120px] resize-none rounded-lg"
                                                />

                                                <div className="mt-2 text-right text-xs text-muted-foreground">
                                                    {studyPreferences.length} / 500
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                                <Button variant="outline">Save as Draft</Button>

                                <Button className="gap-2" onClick={handleGeneratePlan}>
                                    Generate REBYU Calendar
                                    <ArrowRight className="size-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </main>

                <aside className="min-w-0 space-y-4">
                    <Card className="rounded-xl border-border shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <ListChecks className="size-5" />
                                </div>

                                <div>
                                    <CardTitle className="text-sm">Plan Preview</CardTitle>
                                    <CardDescription>Based on your choices</CardDescription>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            <div className="rounded-xl bg-muted/50 p-4">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Certification
                                </p>

                                <p className="mt-1 text-sm font-semibold text-foreground">
                                    {certification}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-muted/50 p-4">
                                    <Clock3 className="size-4 text-primary" />

                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Study days
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                        {studyDays}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-muted/50 p-4">
                                    <CalendarDays className="size-4 text-primary" />

                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Exam date
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                        {targetExamDate}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl bg-muted/50 p-4">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Technique
                                </p>

                                <p className="mt-1 text-sm font-semibold text-foreground">
                                    {selectedTechniqueInfo?.title}
                                </p>

                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                    {selectedTechniqueInfo?.description}
                                </p>
                            </div>

                            <div className="rounded-xl bg-muted/50 p-4">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Priority topics
                                </p>

                                {priorityTopics.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {priorityTopics.map((topic) => (
                                            <Badge key={topic} variant="secondary">
                                                {topic}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                        Priority topics will appear after the diagnostic exam.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-primary/15 bg-primary/5 shadow-none">
                        <CardContent className="p-5">
                            <div className="flex items-start gap-3">
                                <Zap className="mt-1 size-5 shrink-0 text-primary" />

                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">
                                        REBYU will personalize this
                                    </h3>

                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        After your diagnostic exam, this study plan can adapt to weak lessons,
                                        quiz scores, mock exam performance, and readiness score.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </div>
    )
}

export function StudyPlanGenerator({ onPlanGenerated }) {
    return (
        <LearnerPremiumGuard
            feature="PERSONALIZED_STUDY_PLAN"
            title="Pro Feature"
            description="Personalized and AI-generated study plans require a Pro subscription. Upgrade to unlock this feature."
            benefits={[
                "AI-generated, exam-date-aware schedules",
                "Weakness-driven topic prioritization",
                "Adapts to your diagnostic and quiz performance",
            ]}
        >
            <StudyPlanContent onPlanGenerated={onPlanGenerated} />
        </LearnerPremiumGuard>
    )
}

export default function LearningStudyPlan() {
    return <StudyPlanGenerator />
}
