import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bot,
  BookOpenCheck,
  Layers3,
  Loader2,
  MessageCircle,
  Plus,
  SendHorizontal,
  Sparkles,
  Target,
  X,
} from "@/components/icons"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Reveal, motion, popIn } from "@/components/motion/rebyu-motion.jsx"

import { base } from "@/services/base"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"
import { generateStudyAid } from "@/services/learnerToolsService.js"
import { getMyRewardBalance } from "@/services/gamificationService.js"

/**
 * The lesson AI tutor panel.
 *
 * Lifted out of `learner-lesson-page` unchanged so the curriculum's topic
 * surface can mount the same tutor rather than growing a second one that
 * drifts. It owns its own conversation and resets whenever `lessonId` changes.
 */

const AI_TUTOR_ENDPOINT = "ai/tutor"

function createTutorMessageId(prefix = "message") {
  if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
}

function getTutorResponseText(response) {
  const payload = response?.data ?? response ?? {}

  if (typeof payload === "string") {
    return payload
  }

  return (
      payload.answer ??
      payload.reply ??
      payload.message ??
      payload.content ??
      payload.response ??
      ""
  )
}

function getTutorErrorMessage(error) {
  return (
      error?.response?.data?.message ??
      error?.message ??
      "I could not answer right now. Please try again."
  )
}

function TutorAvatar({ size = "size-7" }) {
  return (
      <span
          className={`grid ${size} shrink-0 place-items-center rounded-full bg-gradient-to-br from-rb-beetle to-rb-macaw text-white shadow-[0_2px_0_var(--color-rb-beetle-lip)]`}
      >
        <Bot className="size-3.5" aria-hidden="true" />
      </span>
  )
}

function LearnerAvatar({ size = "size-7", learnerName }) {
  const initial = (learnerName ?? "?").trim().charAt(0).toUpperCase() || "?"
  return (
      <span
          className={`grid ${size} shrink-0 place-items-center rounded-full bg-gradient-to-br from-rb-feather to-rb-macaw text-xs font-extrabold text-white shadow-[0_2px_0_var(--color-rb-macaw-lip)]`}
      >
        {initial}
      </span>
  )
}

function formatMessageTime(timestamp) {
  if (!timestamp) return ""
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function GeminiTutorMessage({ message, learnerName, isFirstInGroup, isLastInGroup }) {
  const isLearner = message.role === "user"

  // Messenger-style grouping: tight gap inside a run of same-sender bubbles,
  // full round on non-tail corners, a "tail" corner only on the last bubble
  // of the run (the one that sits next to the avatar), avatar/name shown
  // once per run instead of once per bubble.
  const tailCorner = isLearner ? "!rounded-br-md" : "!rounded-bl-md"

  return (
      <Message align={isLearner ? "end" : "start"}>
        <MessageContent className="flex-row items-end gap-2.5">
          {!isLearner ? (
              isLastInGroup ? (
                  <TutorAvatar />
              ) : (
                  <span className="size-7 shrink-0" aria-hidden="true" />
              )
          ) : null}

          <div className="min-w-0 flex-1">
            {!isLearner && isFirstInGroup ? (
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rb-beetle-lip">
                  REBYU AI Tutor
                </p>
            ) : null}

            <Bubble
                variant={isLearner ? "default" : "secondary"}
                align={isLearner ? "end" : "start"}
                className={
                  isLearner
                    ? `!rounded-2xl ${tailCorner} !bg-rb-macaw !text-white !shadow-[0_2px_0_var(--color-rb-macaw-lip)]`
                    : `!rounded-2xl ${tailCorner} !border-2 !border-rb-swan !bg-rb-snow !text-rb-eel`
                }
            >
              <BubbleContent className="whitespace-pre-wrap text-sm font-medium leading-6">
                {message.text}
              </BubbleContent>
            </Bubble>

            {isLastInGroup ? (
                <p
                    className={`mt-1 text-[10px] font-medium text-rb-hare ${
                        isLearner ? "text-right" : "text-left"
                    }`}
                >
                  {formatMessageTime(message.createdAt)}
                </p>
            ) : null}
          </div>

          {isLearner ? (
              isLastInGroup ? (
                  <LearnerAvatar learnerName={learnerName} />
              ) : (
                  <span className="size-7 shrink-0" aria-hidden="true" />
              )
          ) : null}
        </MessageContent>
      </Message>
  )
}

export function LessonAiTutor({
                            lessonId,
                            lessonName,
                            learnerName,
                            onClose,
                          }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [generating, setGenerating] = useState(null)
  const entitlements = useLearnerEntitlements()
  const rewardsQuery = useQuery({ queryKey: ["my-reward-balance"], queryFn: getMyRewardBalance, enabled: entitlements.hasPremium })

  useEffect(() => {
    setMessages([])
    setDraft("")
    setPending(false)
  }, [lessonId])

  async function sendTutorMessage(value) {
    const question = String(value ?? "").trim()

    if (!question || pending) {
      return
    }

    setMessages((current) => [
      ...current,
      {
        id: createTutorMessageId("learner"),
        role: "user",
        text: question,
        createdAt: Date.now(),
      },
    ])

    setDraft("")
    setPending(true)

    try {
      const response = await base(AI_TUTOR_ENDPOINT, {
        method: "POST",
        data: {
          sessionId: 1,
          lessonName: lessonName,
          message: question,
        },
      })

      const answer = String(getTutorResponseText(response)).trim()

      if (!answer) {
        throw new Error("The AI Tutor did not return a response.")
      }

      setMessages((current) => [
        ...current,
        {
          id: createTutorMessageId("assistant"),
          role: "assistant",
          text: answer,
          createdAt: Date.now(),
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createTutorMessageId("error"),
          role: "assistant",
          text: getTutorErrorMessage(error),
          createdAt: Date.now(),
        },
      ])
    } finally {
      setPending(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    sendTutorMessage(draft)
  }

  async function createStudyAid(type) {
    if (!entitlements.hasPremium) {
      return
    }
    if (rewardsQuery.isSuccess && (rewardsQuery.data?.aiCredits ?? 0) < 1) {
      toast.error("You need at least 1 AI Credit to generate a study aid. Convert Coins on your dashboard or wait for your next Pro grant.")
      return
    }
    if (generating) return
    setGenerating(type)
    try {
      const item = await generateStudyAid(type, lessonName, Number(lessonId))
      const label = type === "quiz" ? "practice quiz" : "flashcard set"
      setMessages((current) => [...current, {
        id: createTutorMessageId("assistant"),
        role: "assistant",
        text: `Your ${label} has been generated and saved to Library.\n\n${item.description}`,
      }])
      toast.success(`${type === "quiz" ? "Quiz" : "Flashcards"} saved to Library.`)
      rewardsQuery.refetch()
    } catch (error) {
      toast.error(error?.response?.data?.message ?? "The study aid could not be generated.")
    } finally {
      setGenerating(null)
    }
  }

  function handleKeyDown(event) {
    if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      sendTutorMessage(draft)
    }
  }

  const hasConversation = messages.length > 0

  return (
      <section className="flex h-full min-h-0 flex-col bg-rb-snow">
        <header className="relative flex h-16 shrink-0 items-center justify-between overflow-hidden border-b-2 border-rb-swan bg-gradient-to-r from-rb-beetle-wash via-rb-beetle-wash to-rb-snow px-4">
          <div className="flex min-w-0 items-center gap-3">
            <TutorAvatar size="size-10" />

            <div className="min-w-0">
              <p className="font-rb-display text-sm font-extrabold leading-tight text-rb-eel">
                REBYU AI Tutor
              </p>
              <p className="truncate text-xs font-bold text-rb-beetle-lip">
                {lessonName ?? "This lesson"}
              </p>
            </div>
          </div>

          <TactileButton
              variant="ghost"
              size="sm"
              className="rb-btn-icon shrink-0"
              onClick={onClose}
              aria-label="Close AI Tutor"
          >
            <X className="size-4" aria-hidden="true" />
          </TactileButton>
        </header>

        {!hasConversation ? (
            <Reveal
                variants={popIn}
                amount={0}
                className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center"
            >
              <div className="relative">
                <motion.span
                    className="absolute inset-0 -z-10 rounded-full bg-rb-beetle/30 blur-xl"
                    animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.9, 0.55] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                />
                <span className="relative grid size-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-rb-beetle to-rb-macaw text-white shadow-[0_4px_0_var(--color-rb-beetle-lip)]">
                  <Bot className="size-8" aria-hidden="true" />
                </span>
              </div>

              <p className="mt-6 font-rb-display text-xl font-extrabold text-rb-eel">
                Hi {learnerName}, ready to dig in?
              </p>

              <p className="mt-2 max-w-[16rem] text-sm font-medium leading-6 text-rb-wolf">
                Ask anything about{" "}
                <span className="font-bold text-rb-eel">{lessonName ?? "this lesson"}</span> —
                I'll stick to what's covered here.
              </p>

              <div className="mt-7 grid w-full gap-2.5">
                <TactileButton
                    variant="snow"
                    size="sm"
                    className="!h-auto !justify-start !gap-3 !rounded-2xl !border-2 !border-rb-swan !py-3 text-left hover:!border-rb-macaw/50"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage("Explain this lesson in simple words.")
                    }
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rb-macaw-wash text-rb-macaw-lip">
                    <Sparkles className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-rb-eel">Explain simply</span>
                    <span className="block text-xs font-medium text-rb-wolf">
                      Break it down in plain words
                    </span>
                  </span>
                </TactileButton>

                <TactileButton
                    variant="snow"
                    size="sm"
                    className="!h-auto !justify-start !gap-3 !rounded-2xl !border-2 !border-rb-swan !py-3 text-left hover:!border-rb-feather/50"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage(
                            "Give me a simple real-life example about this topic."
                        )
                    }
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rb-feather-wash text-rb-feather-ink">
                    <MessageCircle className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-rb-eel">Give example</span>
                    <span className="block text-xs font-medium text-rb-wolf">
                      See it applied in real life
                    </span>
                  </span>
                </TactileButton>

                <TactileButton
                    variant="snow"
                    size="sm"
                    className="!h-auto !justify-start !gap-3 !rounded-2xl !border-2 !border-rb-swan !py-3 text-left hover:!border-rb-bee/50"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage(
                            "Create one short practice question about this lesson."
                        )
                    }
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rb-bee-wash text-[#0092a8]">
                    <Target className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-rb-eel">Practice me</span>
                    <span className="block text-xs font-medium text-rb-wolf">
                      Try one quick question
                    </span>
                  </span>
                </TactileButton>
              </div>
            </Reveal>
        ) : (
            <MessageScrollerProvider autoScroll scrollPreviousItemPeek={48}>
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent
                      className="px-4 py-5"
                      aria-busy={pending}
                  >
                    {messages.map((message, index) => {
                      const prev = messages[index - 1]
                      const next = messages[index + 1]
                      const isFirstInGroup = !prev || prev.role !== message.role
                      const isLastInGroup = !next || next.role !== message.role

                      return (
                          <MessageScrollerItem
                              key={message.id}
                              messageId={message.id}
                              scrollAnchor={message.role === "user"}
                              className={index === 0 ? "" : isFirstInGroup ? "mt-5" : "mt-1"}
                          >
                            <GeminiTutorMessage
                                message={message}
                                learnerName={learnerName}
                                isFirstInGroup={isFirstInGroup}
                                isLastInGroup={isLastInGroup}
                            />
                          </MessageScrollerItem>
                      )
                    })}

                    {pending ? (
                        <MessageScrollerItem messageId={`thinking-${lessonId}`} className="mt-5">
                          <Message align="start">
                            <MessageContent className="flex-row items-end gap-2.5">
                              <TutorAvatar />

                              <div className="min-w-0 flex-1">
                                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rb-beetle-lip">
                                  REBYU AI Tutor
                                </p>

                                <Bubble
                                    variant="secondary"
                                    className="!rounded-2xl !rounded-bl-md !border-2 !border-rb-swan !bg-rb-snow"
                                >
                                  <BubbleContent className="flex items-center gap-2 text-sm font-medium text-rb-wolf">
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                    Thinking...
                                  </BubbleContent>
                                </Bubble>
                              </div>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>

                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
        )}

        <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t-2 border-rb-swan bg-rb-polar/60 p-3"
        >
          <div className="rounded-2xl border-2 border-rb-swan bg-rb-snow p-2 shadow-[0_2px_0_var(--color-rb-swan)] transition-colors focus-within:border-rb-macaw/60">
            <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to ask about this lesson"
                disabled={pending}
                className="min-h-[64px] resize-none border-0 bg-transparent px-2 py-2 text-sm font-medium text-rb-eel shadow-none outline-none focus-visible:ring-0"
            />

            <div className="flex items-center justify-between px-1 pb-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <TactileButton
                      variant="ghost"
                      size="sm"
                      className="rb-btn-icon"
                      aria-label="Create study aid"
                  >
                    {generating ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Plus className="size-4" aria-hidden="true" />
                    )}
                  </TactileButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>
                    <span className="block text-sm font-bold text-rb-eel">Create with AI</span>
                    <span className="mt-0.5 block text-xs font-medium text-rb-wolf">Generated items are saved to Library. {entitlements.hasPremium ? `${rewardsQuery.data?.aiCredits ?? 0} AI Credits available.` : "Pro required."}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      if (!entitlements.hasPremium) event.preventDefault()
                      createStudyAid("quiz")
                    }}
                    disabled={Boolean(generating) || (entitlements.hasPremium && rewardsQuery.isSuccess && (rewardsQuery.data?.aiCredits ?? 0) < 1)}
                  >
                    <BookOpenCheck className="mr-2 size-4" />
                    <span className="flex-1">Generate quiz</span>
                    {!entitlements.hasPremium ? <span className="rounded bg-rb-macaw-wash px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rb-macaw-lip">PRO</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      if (!entitlements.hasPremium) event.preventDefault()
                      createStudyAid("flashcard")
                    }}
                    disabled={Boolean(generating) || (entitlements.hasPremium && rewardsQuery.isSuccess && (rewardsQuery.data?.aiCredits ?? 0) < 1)}
                  >
                    <Layers3 className="mr-2 size-4" />
                    <span className="flex-1">Generate flashcards</span>
                    {!entitlements.hasPremium ? <span className="rounded bg-rb-macaw-wash px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rb-macaw-lip">PRO</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2">
              <span className="hidden text-[10px] font-bold uppercase tracking-wide text-rb-hare sm:inline">
                REBYU AI
              </span>

                <TactileButton
                    type="submit"
                    variant="macaw"
                    size="sm"
                    className="rb-btn-icon"
                    disabled={pending || !draft.trim()}
                    aria-label="Send message"
                >
                  {pending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                      <SendHorizontal className="size-4" aria-hidden="true" />
                  )}
                </TactileButton>
              </div>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] font-medium text-rb-hare">
            AI responses may be inaccurate. Review your lesson materials.
          </p>
        </form>
      </section>
  )
}
