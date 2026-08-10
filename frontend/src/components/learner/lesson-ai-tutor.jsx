import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
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
const AI_TUTOR_CONVERSATION_ENDPOINT = "ai/tutor/conversation"
const AI_TUTOR_APPEND_ENDPOINT = "ai/tutor/conversation/messages"

// Matches the thread-id convention the tutor itself keys conversations on
// (see `tutor_service.get_conversation` server-side) so history sent here
// is the same history a later chat turn appends to.
function buildTutorSessionId(learnerId, lessonId) {
  return `${learnerId ?? "guest"}-${lessonId}`
}

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

// Same face+lip tactile recipe the rest of the app's buttons/cards use
// (solid colour, 4px solid "lip" shadow, no blur) rather than a flat fill or
// a soft drop-shadow -- an avatar built any other way reads as a mismatched
// component next to everything around it.
function TutorAvatar({ size = "size-7", iconSize = "size-4", onViolet = false }) {
  return (
      <span
          className={`grid ${size} shrink-0 place-items-center rounded-full ring-2 ${
              onViolet
                ? "bg-white text-rb-beetle-lip ring-white/40"
                : "bg-rb-beetle text-white shadow-[0_2px_0_var(--color-rb-beetle-lip)] ring-white"
          }`}
      >
        <Sparkles className={iconSize} aria-hidden="true" />
      </span>
  )
}

function LearnerAvatar({ size = "size-7", learnerName }) {
  const initial = (learnerName ?? "?").trim().charAt(0).toUpperCase() || "?"
  return (
      <span
          className={`grid ${size} shrink-0 place-items-center rounded-full bg-rb-eel text-xs font-extrabold text-white shadow-[0_2px_0_#2d2d31] ring-2 ring-white`}
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

/**
 * The card a generated quiz/flashcard set lands as, inside the tutor's own
 * reply -- the learner opens it straight from the conversation rather than
 * being told it exists and left to find it in Library.
 */
function StudyAidActionCard({ action }) {
  const navigate = useNavigate()
  const Icon = action.kind === "flashcard" ? Layers3 : BookOpenCheck

  return (
      <div className="mt-3 rounded-xl border-2 border-rb-beetle/25 bg-rb-beetle-wash p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rb-beetle text-white shadow-[0_2px_0_var(--color-rb-beetle-lip)]">
            <Icon className="size-4" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-rb-eel">{action.title}</p>
            <p className="mt-0.5 text-xs font-medium text-rb-wolf">{action.meta}</p>
          </div>
        </div>

        <TactileButton
            type="button"
            variant="beetle"
            size="sm"
            className="!mt-3 !w-full !gap-2"
            onClick={() => navigate(action.href)}
        >
          {action.label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </TactileButton>
      </div>
  )
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

          {/* `flex flex-col` + `items-end`/`items-start` is what actually
              pushes the bubble (and its timestamp) to the correct side --
              `Bubble`'s own `self-end`/`self-start` only takes effect inside
              a flex column, and without one here it was a no-op, leaving
              every bubble at its natural block position (the left). */}
          <div className={`flex min-w-0 flex-1 flex-col ${isLearner ? "items-end" : "items-start"}`}>
            {!isLearner && isFirstInGroup ? (
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rb-beetle-lip">
                  REBYU AI Tutor
                </p>
            ) : null}

            {/* Bubble's `variant` injects fill/text colour onto BubbleContent
                via a `*:data-[slot=bubble-content]:bg-*` descendant selector,
                which out-specifies a plain utility class written directly on
                BubbleContent -- so overriding the look here means every
                property (fill, border, radius, the tactile "lip" shadow) has
                to carry `!important` to actually win. */}
            <Bubble
                variant="secondary"
                align={isLearner ? "end" : "start"}
                // A bubble carrying an action card needs the room for it;
                // Bubble's own `max-w-[80%]` would squeeze the button.
                className={message.action ? "!max-w-[94%]" : ""}
            >
              <BubbleContent
                  className={
                    isLearner
                      ? `!rounded-2xl ${tailCorner} !border-0 !bg-rb-beetle !px-3.5 !py-2.5 !text-white !shadow-[0_3px_0_var(--color-rb-beetle-lip)]`
                      : `!rounded-2xl ${tailCorner} ${message.action ? "!w-full" : ""} !border-2 !border-rb-swan !bg-rb-snow !px-3.5 !py-2.5 !text-rb-eel !shadow-[0_3px_0_var(--color-rb-swan)]`
                  }
              >
                <span className="whitespace-pre-wrap text-sm font-medium leading-6">
                  {message.text}
                </span>

                {message.action ? <StudyAidActionCard action={message.action} /> : null}
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
                            learnerId,
                            onClose,
                          }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [generating, setGenerating] = useState(null)
  const rewardsQuery = useQuery({ queryKey: ["my-reward-balance"], queryFn: getMyRewardBalance })

  // Each lesson has its own thread on the server (see `buildTutorSessionId`),
  // so switching lessons should restore that lesson's own past conversation
  // rather than always starting blank -- and a page refresh shouldn't lose
  // today's conversation either.
  useEffect(() => {
    let cancelled = false

    setMessages([])
    setDraft("")
    setPending(false)

    if (lessonId == null) {
      return undefined
    }

    setLoadingHistory(true)

    base(
        `${AI_TUTOR_CONVERSATION_ENDPOINT}?sessionId=${encodeURIComponent(
            buildTutorSessionId(learnerId, lessonId)
        )}`
    )
        .then((response) => {
          if (cancelled) return

          const history = response?.data?.messages ?? response?.messages ?? []
          setMessages(
              history.map((entry, index) => ({
                id: createTutorMessageId(`history-${index}`),
                role: entry.role === "user" ? "user" : "assistant",
                text: entry.content,
                // Present only on a generated quiz/flashcard turn -- restores
                // its "Take the quiz" card rather than leaving a sentence
                // about something the learner can't open from here.
                action: entry.action ?? undefined,
              }))
          )
        })
        .catch(() => {
          // No saved conversation yet (or the lookup failed) -- starting
          // blank is the right fallback either way.
        })
        .finally(() => {
          if (!cancelled) setLoadingHistory(false)
        })

    return () => {
      cancelled = true
    }
  }, [lessonId, learnerId])

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
          sessionId: buildTutorSessionId(learnerId, lessonId),
          lessonName: lessonName,
          lessonId: lessonId != null ? Number(lessonId) : null,
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
    if (generating || pending) return

    const label = type === "quiz" ? "quiz" : "flashcards"
    const prompt = `Create a ${label} for this lesson.`

    // Goes through the chat thread exactly like a typed question -- a sent
    // bubble, the "thinking" indicator, then the reply -- rather than a
    // silent background action reported only through a toast.
    setMessages((current) => [
      ...current,
      {
        id: createTutorMessageId("learner"),
        role: "user",
        text: prompt,
        createdAt: Date.now(),
      },
    ])
    setGenerating(type)

    try {
      const item = await generateStudyAid(type, lessonName, Number(lessonId))
      const isQuiz = type === "quiz"
      const reply = isQuiz
        ? "Your practice quiz is ready. It's saved to your Library too, so you can come back to it any time."
        : "Your flashcard set is ready. It's saved to your Library too, so you can come back to it any time."
      // Rendered as a tappable card by `StudyAidActionCard`, so the learner
      // starts it straight from the conversation instead of being told
      // where to go find it.
      const action = {
        kind: type,
        title: item.title,
        meta: isQuiz ? "10 questions · practice quiz" : "10 cards · flashcard set",
        label: isQuiz ? "Take the quiz" : "Study the flashcards",
        href: item.route,
      }

      setMessages((current) => [
        ...current,
        {
          id: createTutorMessageId("assistant"),
          role: "assistant",
          text: reply,
          action,
          createdAt: Date.now(),
        },
      ])

      // Generation never runs through the chat graph, so nothing would have
      // recorded this exchange -- it survived only in local state and
      // vanished on refresh while typed questions persisted. Recording it
      // against the same thread keeps the conversation whole.
      base(AI_TUTOR_APPEND_ENDPOINT, {
        method: "POST",
        data: {
          sessionId: buildTutorSessionId(learnerId, lessonId),
          messages: [
            { role: "user", content: prompt },
            { role: "assistant", content: reply, action },
          ],
        },
      }).catch(() => {
        // The learner still has the working card in front of them; losing
        // only the history entry isn't worth interrupting them over.
      })

      rewardsQuery.refetch()
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createTutorMessageId("error"),
          role: "assistant",
          text: error?.response?.data?.message ?? "The study aid could not be generated.",
          createdAt: Date.now(),
        },
      ])
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
        <header className="relative flex h-16 shrink-0 items-center justify-between overflow-hidden bg-rb-beetle px-4">
          <div className="flex min-w-0 items-center gap-3">
            <TutorAvatar size="size-10" iconSize="size-5" onViolet />

            <div className="min-w-0">
              <p className="font-rb-display text-sm font-extrabold leading-tight text-white">
                REBYU AI Tutor
              </p>
              <p className="flex items-center gap-1.5 truncate text-xs font-bold text-white/80">
                <span className="size-1.5 shrink-0 rounded-full bg-rb-feather" aria-hidden="true" />
                {lessonName ?? "This lesson"}
              </p>
            </div>
          </div>

          <TactileButton
              variant="ghost"
              size="sm"
              className="rb-btn-icon shrink-0 !border-transparent hover:!bg-white/15"
              // The ghost variant's face/ink are a light background + dark
              // icon by default -- on the violet header that renders as
              // white-on-white. Overriding the CSS vars the button reads its
              // colors from (rather than fighting them with utility classes)
              // makes the face transparent and the icon white.
              style={{ "--rb-btn-face": "transparent", "--rb-btn-ink": "#ffffff" }}
              onClick={onClose}
              aria-label="Close AI Tutor"
          >
            <X className="size-4" aria-hidden="true" />
          </TactileButton>
        </header>

        {loadingHistory ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
              <Loader2 className="size-5 animate-spin text-rb-beetle-lip" aria-hidden="true" />
              <p className="text-xs font-bold text-rb-hare">Loading your conversation…</p>
            </div>
        ) : !hasConversation ? (
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
                <span className="relative grid size-16 shrink-0 place-items-center rounded-3xl bg-rb-beetle text-white shadow-[0_4px_0_var(--color-rb-beetle-lip)] ring-2 ring-white">
                  <Sparkles className="size-8" aria-hidden="true" />
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

              <div className="mt-7 flex w-full flex-wrap justify-center gap-2">
                <TactileButton
                    variant="snow"
                    size="sm"
                    className="!h-auto !gap-1.5 !rounded-full !border-2 !border-rb-beetle/30 !bg-white !px-3.5 !py-2 !text-rb-beetle-lip hover:!border-rb-beetle hover:!bg-rb-beetle-wash"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage("Explain this lesson in simple words.")
                    }
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span className="text-xs font-bold">Explain simply</span>
                </TactileButton>

                <TactileButton
                    variant="snow"
                    size="sm"
                    className="!h-auto !gap-1.5 !rounded-full !border-2 !border-rb-beetle/30 !bg-white !px-3.5 !py-2 !text-rb-beetle-lip hover:!border-rb-beetle hover:!bg-rb-beetle-wash"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage(
                            "Give me a simple real-life example about this topic."
                        )
                    }
                >
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  <span className="text-xs font-bold">Give example</span>
                </TactileButton>

                <TactileButton
                    variant="snow"
                    size="sm"
                    className="!h-auto !gap-1.5 !rounded-full !border-2 !border-rb-beetle/30 !bg-white !px-3.5 !py-2 !text-rb-beetle-lip hover:!border-rb-beetle hover:!bg-rb-beetle-wash"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage(
                            "Create one short practice question about this lesson."
                        )
                    }
                >
                  <Target className="size-3.5" aria-hidden="true" />
                  <span className="text-xs font-bold">Practice me</span>
                </TactileButton>
              </div>
            </Reveal>
        ) : (
            <MessageScrollerProvider autoScroll scrollPreviousItemPeek={48}>
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent
                      className="px-4 py-5"
                      aria-busy={pending || Boolean(generating)}
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

                    {pending || generating ? (
                        <MessageScrollerItem messageId={`thinking-${lessonId}`} className="mt-5">
                          <Message align="start">
                            <MessageContent className="flex-row items-end gap-2.5">
                              <TutorAvatar />

                              <div className="min-w-0 flex-1">
                                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-rb-beetle-lip">
                                  REBYU AI Tutor
                                </p>

                                <Bubble variant="secondary">
                                  <BubbleContent className="!flex !items-center !gap-2 !rounded-2xl !rounded-bl-md !border-2 !border-rb-swan !bg-rb-snow !px-3.5 !py-2.5 !text-sm !font-medium !text-rb-wolf !shadow-[0_3px_0_var(--color-rb-swan)]">
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
          <div className="flex items-end gap-1.5 rounded-full border-2 border-rb-swan bg-rb-snow py-1.5 pl-1.5 pr-2 shadow-[0_2px_0_var(--color-rb-swan)] transition-colors focus-within:border-rb-beetle/60">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TactileButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rb-btn-icon shrink-0 self-center !rounded-full"
                    disabled={pending || Boolean(generating)}
                    aria-label="Create study aid"
                >
                  {generating ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                      <Plus className="size-4" aria-hidden="true" />
                  )}
                </TactileButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-64">
                <DropdownMenuLabel>
                  <span className="block text-sm font-bold text-rb-eel">Create with AI</span>
                  <span className="mt-0.5 block text-xs font-medium text-rb-wolf">Generated items are saved to Library. {rewardsQuery.data?.aiCredits ?? 0} AI Credits available.</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => createStudyAid("quiz")}
                  disabled={Boolean(generating)}
                >
                  <BookOpenCheck className="mr-2 size-4" />
                  <span className="flex-1">Generate quiz</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => createStudyAid("flashcard")}
                  disabled={Boolean(generating)}
                >
                  <Layers3 className="mr-2 size-4" />
                  <span className="flex-1">Generate flashcards</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to ask about this lesson"
                disabled={pending || Boolean(generating)}
                rows={1}
                className="max-h-24 min-h-0 flex-1 resize-none self-center border-0 bg-transparent px-1 py-1.5 text-sm font-medium text-rb-eel shadow-none outline-none focus-visible:ring-0"
            />

            <TactileButton
                type="submit"
                variant="beetle"
                size="sm"
                className="rb-btn-icon shrink-0 self-center !rounded-full"
                disabled={pending || Boolean(generating) || !draft.trim()}
                aria-label="Send message"
            >
              {pending || generating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                  <SendHorizontal className="size-4" aria-hidden="true" />
              )}
            </TactileButton>
          </div>

          <p className="mt-2 text-center text-[10px] font-medium text-rb-hare">
            REBYU AI &middot; responses may be inaccurate, review your lesson materials
          </p>
        </form>
      </section>
  )
}
