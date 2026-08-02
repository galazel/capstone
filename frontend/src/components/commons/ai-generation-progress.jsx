import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, Sparkles } from "@/components/icons"

const DEFAULT_SENTENCES = [
    "This usually takes a little while — hang tight.",
    "Reading through your documents carefully...",
    "Good content takes a moment to write.",
    "Structuring everything so it's easy to learn from...",
    "Almost there — quality checks in progress.",
    "Still working — big documents take a bit longer.",
    "Polishing the wording and formatting...",
]







export default function AiGenerationProgress({
                                                 open,
                                                 title = "Generating with AI",
                                                 description = "",
                                                 steps = [],
                                                 sentences = DEFAULT_SENTENCES,
                                                 stepDurationMs = 6000,
                                             }) {
    const [activeStep, setActiveStep] = useState(0)
    const [sentenceIndex, setSentenceIndex] = useState(0)

    useEffect(() => {
        if (!open) {
            return
        }

        setActiveStep(0)
        setSentenceIndex(0)

        const stepTimer = window.setInterval(() => {
            setActiveStep((currentStep) =>
                Math.min(currentStep + 1, Math.max(steps.length - 1, 0))
            )
        }, stepDurationMs)

        const sentenceTimer = window.setInterval(() => {
            setSentenceIndex((currentIndex) => currentIndex + 1)
        }, 4000)

        return () => {
            window.clearInterval(stepTimer)
            window.clearInterval(sentenceTimer)
        }
    }, [open, steps.length, stepDurationMs])

    if (!open) {
        return null
    }

    const progressPercent = Math.min(
        ((activeStep + 0.5) / Math.max(steps.length, 1)) * 100,
        92
    )

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        >
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-foreground">
                            {title}
                        </h2>

                        {description && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                <ul className="mt-5 space-y-3">
                    {steps.map((step, index) => {
                        const isDone = index < activeStep
                        const isActive = index === activeStep

                        return (
                            <li
                                key={step}
                                className={`flex items-center gap-3 text-sm transition-colors ${
                                    isDone
                                        ? "text-foreground"
                                        : isActive
                                            ? "font-medium text-foreground"
                                            : "text-muted-foreground/60"
                                }`}
                            >
                                {isDone ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                                ) : isActive ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                                ) : (
                                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                    </span>
                                )}

                                <span>{step}</span>
                            </li>
                        )
                    })}
                </ul>

                <p className="mt-5 min-h-5 text-center text-xs italic text-muted-foreground">
                    {sentences[sentenceIndex % sentences.length]}
                </p>
            </div>
        </div>
    )
}
