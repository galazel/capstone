import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
    BrainCircuit,
    CheckCircle2,
    ChevronDown,
    CircleAlert,
    Eye,
    Filter,
    RotateCcw,
    Search,
    Target,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    LearnerEmptyState,
    LearnerPageHeader,
} from "@/components/learner/learner-ui.jsx"
import { getMistakes, setMistakeReviewed } from "@/services/learnerToolsService"
import { toast } from "sonner"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"

const ALL_VALUE = "all"

const masteryStyles = {
    weak:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    developing:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    good:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    mastered:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
}

function MasteryBadge({ status }) {
    const normalized = String(status ?? "weak").toLowerCase()

    return (
        <Badge
            variant="outline"
            className={masteryStyles[normalized] ?? masteryStyles.weak}
        >
            {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
        </Badge>
    )
}

export default function MistakesBank() {
    const entitlements = useLearnerEntitlements()
    const navigate = useNavigate()
    const [mistakes, setMistakes] = useState([])
    const [searchQuery, setSearchQuery] = useState("")
    const [certificationFilter, setCertificationFilter] = useState(ALL_VALUE)
    const [typeFilter, setTypeFilter] = useState(ALL_VALUE)
    const [statusFilter, setStatusFilter] = useState(ALL_VALUE)
    const [expandedIds, setExpandedIds] = useState(new Set())

    useEffect(() => {
        if (entitlements.isLoading) return
        if (!entitlements.hasPremium) {
            navigate("/learner/learning", { replace: true })
            return
        }
        getMistakes().then(setMistakes).catch(() => toast.error("Your mistake notebook could not be loaded."))
    }, [entitlements.hasPremium, entitlements.isLoading, navigate])

    const certifications = useMemo(
        () => [
            ...new Set(
                mistakes
                    .map((mistake) => mistake.certificationTitle)
                    .filter(Boolean)
            ),
        ],
        [mistakes]
    )

    const questionTypes = useMemo(
        () => [
            ...new Set(
                mistakes
                    .map((mistake) => mistake.questionType)
                    .filter(Boolean)
            ),
        ],
        [mistakes]
    )

    const visibleMistakes = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return mistakes.filter((mistake) => {
            const matchesSearch =
                !query ||
                (mistake.question || "").toLowerCase().includes(query) ||
                (mistake.lessonTitle || "").toLowerCase().includes(query) ||
                (mistake.certificationTitle || "").toLowerCase().includes(query)

            const matchesCertification =
                certificationFilter === ALL_VALUE ||
                mistake.certificationTitle === certificationFilter

            const matchesType =
                typeFilter === ALL_VALUE ||
                mistake.questionType === typeFilter

            const matchesStatus =
                statusFilter === ALL_VALUE ||
                (statusFilter === "reviewed"
                    ? mistake.reviewed
                    : !mistake.reviewed)

            return (
                matchesSearch &&
                matchesCertification &&
                matchesType &&
                matchesStatus
            )
        })
    }, [
        certificationFilter,
        mistakes,
        searchQuery,
        statusFilter,
        typeFilter,
    ])

    const reviewedCount = mistakes.filter((mistake) => mistake.reviewed).length
    const repeatedCount = mistakes.filter(
        (mistake) => mistake.mistakeCount > 1
    ).length

    function toggleExpanded(mistakeId) {
        setExpandedIds((current) => {
            const next = new Set(current)

            if (next.has(mistakeId)) {
                next.delete(mistakeId)
            } else {
                next.add(mistakeId)
            }

            return next
        })
    }

    async function markReviewed(mistakeId) {
        const mistake = mistakes.find((item) => item.mistakeId === mistakeId)
        if (!mistake) return
        try { await setMistakeReviewed(mistake.questionId, true) } catch { toast.error("Review status could not be saved."); return }
        setMistakes((current) =>
            current.map((mistake) =>
                mistake.mistakeId === mistakeId
                    ? { ...mistake, reviewed: true }
                    : mistake
            )
        )
    }

    return (
        <div className="space-y-6">
            <LearnerPageHeader
                title="Mistake Notebook"
                subtitle="Review questions you answered incorrectly and strengthen weak lessons."
            />

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y py-4">
                <div>
                    <p className="text-xs font-medium text-muted-foreground">
                        Total mistakes
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                        {mistakes.length}
                    </p>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground">
                        Reviewed
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                        {reviewedCount}
                    </p>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground">
                        Repeated mistakes
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                        {repeatedCount}
                    </p>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground">
                        Needs review
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                        {mistakes.length - reviewedCount}
                    </p>
                </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px_160px]">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search mistakes, lessons, or certifications..."
                        className="pl-9"
                    />
                </div>

                <Select
                    value={certificationFilter}
                    onValueChange={setCertificationFilter}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All certifications" />
                    </SelectTrigger>

                    <SelectContent>
                        <SelectItem value={ALL_VALUE}>All certifications</SelectItem>

                        {certifications.map((certification) => (
                            <SelectItem key={certification} value={certification}>
                                {certification}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="All types" />
                    </SelectTrigger>

                    <SelectContent>
                        <SelectItem value={ALL_VALUE}>All types</SelectItem>

                        {questionTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                                {type}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Review status" />
                    </SelectTrigger>

                    <SelectContent>
                        <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                        <SelectItem value="pending">Needs review</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {visibleMistakes.length === 0 ? (
                <LearnerEmptyState
                    icon={CheckCircle2}
                    title="No mistakes found"
                    description="Your incorrect answers will appear here after quizzes and exams."
                />
            ) : (
                <div className="overflow-x-auto border-y">
                    <table className="w-full min-w-[1040px] border-collapse text-left">
                        <thead>
                        <tr className="border-b bg-muted/40">
                            <th className="w-12 px-3 py-3" />
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Question
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Certification / Lesson
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Type
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Attempts
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Mastery
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Actions
                            </th>
                        </tr>
                        </thead>

                        <tbody>
                        {visibleMistakes.map((mistake) => {
                            const expanded = expandedIds.has(mistake.mistakeId)

                            return (
                                <React.Fragment key={mistake.mistakeId}>
                                    <tr className="border-b transition hover:bg-muted/30">
                                        <td className="px-3 py-4">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() =>
                                                    toggleExpanded(mistake.mistakeId)
                                                }
                                                aria-label={
                                                    expanded
                                                        ? "Collapse mistake"
                                                        : "Expand mistake"
                                                }
                                            >
                                                <ChevronDown
                                                    className={`h-4 w-4 transition ${
                                                        expanded ? "rotate-180" : ""
                                                    }`}
                                                />
                                            </Button>
                                        </td>

                                        <td className="max-w-lg px-4 py-4">
                                            <p className="line-clamp-2 text-sm font-medium leading-6">
                                                {mistake.question}
                                            </p>

                                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{mistake.attemptSource}</span>
                                                <span>·</span>
                                                <span className="capitalize">
                            {(mistake.difficulty || "").toLowerCase()}
                          </span>
                                            </div>
                                        </td>

                                        <td className="max-w-56 px-4 py-4">
                                            <p className="truncate text-sm font-medium">
                                                {mistake.certificationTitle}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                {mistake.lessonTitle}
                                            </p>
                                        </td>

                                        <td className="px-4 py-4">
                                            <Badge variant="outline">
                                                {mistake.questionType}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium tabular-nums">
                            {mistake.mistakeCount}
                          </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-4">
                                            <MasteryBadge status={mistake.masteryStatus} />
                                        </td>

                                        <td className="px-4 py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        toggleExpanded(mistake.mistakeId)
                                                    }
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Review
                                                </Button>

                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() =>
                                                        markReviewed(mistake.mistakeId)
                                                    }
                                                    disabled={mistake.reviewed}
                                                >
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                    {mistake.reviewed
                                                        ? "Reviewed"
                                                        : "Mark reviewed"}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>

                                    {expanded ? (
                                        <tr className="border-b bg-muted/20">
                                            <td />
                                            <td colSpan={6} className="px-4 py-5">
                                                <div className="grid gap-5 lg:grid-cols-2">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <CircleAlert className="h-4 w-4 text-destructive" />
                                                            <p className="text-sm font-semibold">
                                                                Your answer
                                                            </p>
                                                        </div>

                                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                                            {mistake.learnerAnswer || "No answer submitted."}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Target className="h-4 w-4 text-primary" />
                                                            <p className="text-sm font-semibold">
                                                                Correct answer
                                                            </p>
                                                        </div>

                                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                                            {mistake.correctAnswer}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                                                    <Button type="button" size="sm">
                                                        <BrainCircuit className="mr-2 h-4 w-4" />
                                                        Practice similar questions
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Open lesson
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : null}
                                </React.Fragment>
                            )
                        })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
