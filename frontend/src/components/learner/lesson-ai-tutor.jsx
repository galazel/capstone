import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bot,
  BookOpenCheck,
  Layers3,
  Loader2,
  Plus,
  SendHorizontal,
  Sparkles,
  X,
} from "@/components/icons"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
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

function GeminiTutorMessage({ message }) {
  const isLearner = message.role === "user"

  return (
      <Message align={isLearner ? "end" : "start"}>
        <MessageContent>
          {!isLearner ? (
              <p className="mb-1 text-xs font-semibold text-primary">
                REBYU AI Tutor
              </p>
          ) : null}

          <Bubble
              variant={isLearner ? "default" : "secondary"}
              align={isLearner ? "end" : "start"}
          >
            <BubbleContent className="whitespace-pre-wrap text-sm leading-6">
              {message.text}
            </BubbleContent>
          </Bubble>
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
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createTutorMessageId("error"),
          role: "assistant",
          text: getTutorErrorMessage(error),
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
      <section className="flex h-full min-h-0 flex-col bg-white">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-100 px-4">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />

            <p className="text-sm font-semibold text-zinc-800">
              REBYU AI Tutor
            </p>
          </div>

          <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close AI Tutor"
              className="size-8 text-zinc-500 hover:text-zinc-950"
          >
            <X className="size-4" />
          </Button>
        </header>

        {!hasConversation ? (
            <div className="flex min-h-0 flex-1 flex-col justify-end px-5 pb-7">
              <div>
                <p className="text-xl font-semibold tracking-tight text-primary">
                  Hello, {learnerName}
                </p>

                <h2 className="mt-1 text-xl font-medium tracking-tight text-zinc-700">
                  How can I help you today?
                </h2>

                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  Ask me anything about{" "}
                  <span className="font-medium text-zinc-700">
                {lessonName ?? "this lesson"}
              </span>
                  .
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage("Explain this lesson in simple words.")
                    }
                >
                  <Sparkles className="size-3.5" />
                  Explain simply
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage(
                            "Give me a simple real-life example about this topic."
                        )
                    }
                >
                  Give example
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    disabled={pending}
                    onClick={() =>
                        sendTutorMessage(
                            "Create one short practice question about this lesson."
                        )
                    }
                >
                  Practice me
                </Button>
              </div>
            </div>
        ) : (
            <MessageScrollerProvider autoScroll scrollPreviousItemPeek={48}>
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent
                      className="space-y-5 px-4 py-5"
                      aria-busy={pending}
                  >
                    {messages.map((message) => (
                        <MessageScrollerItem
                            key={message.id}
                            messageId={message.id}
                            scrollAnchor={message.role === "user"}
                        >
                          <GeminiTutorMessage message={message} />
                        </MessageScrollerItem>
                    ))}

                    {pending ? (
                        <MessageScrollerItem messageId={`thinking-${lessonId}`}>
                          <Message align="start">
                            <MessageContent>
                              <p className="mb-1 text-xs font-semibold text-primary">
                                REBYU AI Tutor
                              </p>

                              <Bubble variant="secondary">
                                <BubbleContent className="flex items-center gap-2 text-sm text-zinc-500">
                                  <Loader2 className="size-4 animate-spin" />
                                  Thinking...
                                </BubbleContent>
                              </Bubble>
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
            className="shrink-0 border-t border-zinc-100 bg-white p-4"
        >
          <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to ask about this lesson"
                disabled={pending}
                className="min-h-[72px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none outline-none focus-visible:ring-0"
            />

            <div className="flex items-center justify-between px-1 pb-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-zinc-500" aria-label="Create study aid">
                    {generating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>
                    <span className="block text-sm">Create with AI</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Generated items are saved to Library. {entitlements.hasPremium ? `${rewardsQuery.data?.aiCredits ?? 0} AI Credits available.` : "Pro required."}</span>
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
                    {!entitlements.hasPremium ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">PRO</span> : null}
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
                    {!entitlements.hasPremium ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">PRO</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2">
              <span className="hidden text-[10px] text-zinc-400 sm:inline">
                REBYU AI
              </span>

                <Button
                    type="submit"
                    size="icon"
                    disabled={pending || !draft.trim()}
                    aria-label="Send message"
                    className="size-8 rounded-lg"
                >
                  {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                  ) : (
                      <SendHorizontal className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] text-zinc-400">
            AI responses may be inaccurate. Review your lesson materials.
          </p>
        </form>
      </section>
  )
}
