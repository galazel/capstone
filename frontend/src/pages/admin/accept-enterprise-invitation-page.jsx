import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2, CircleAlert, Loader2, Mail, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { base } from "@/services/base"

const ACCEPT_INVITATION_ENDPOINT = "learners/accept-invitation"
const LEARNER_LEARNING_ROUTE = "/learner/learning"
const LOGIN_ROUTE = "/login"
const PENDING_INVITATION_KEY = "rebyu_pending_invitation_token"

// Friendly messages keyed by the backend errorCode, with an HTTP-status
// fallback for anything unexpected.
const ERROR_BY_CODE = {
  INVALID_TOKEN: "This invitation link is invalid. Please use the exact link from your email.",
  INVITATION_EXPIRED: "This invitation has expired. Ask your organization to send a new one.",
  INVITATION_REVOKED: "This invitation was cancelled by your organization.",
  ALREADY_ACCEPTED: "This invitation has already been accepted.",
  EMAIL_MISMATCH:
    "This invitation was sent to a different email. Sign in with the invited email address.",
  ALREADY_ENROLLED: "You already have access to this certification.",
  NOT_AUTHENTICATED: "Please sign in to accept this invitation.",
}

function resolveError(error) {
  const status = error?.response?.status ?? error?.status
  const code = error?.response?.data?.errorCode
  const message =
    (code && ERROR_BY_CODE[code]) ||
    error?.response?.data?.message ||
    (status === 401 || status === 403
      ? "Please sign in using the email address that received this invitation."
      : "This invitation is invalid, expired, cancelled, or has already been used.")
  return { status, code, message }
}

export default function AcceptEnterpriseInvitationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const token = String(searchParams.get("token") ?? "").trim()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [certificationTitle, setCertificationTitle] = useState("")

  const hasValidToken = Boolean(token)

  async function handleAcceptInvitation() {
    if (!hasValidToken || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      // base() returns response.data directly.
      const payload = await base(ACCEPT_INVITATION_ENDPOINT, {
        method: "POST",
        data: { token },
      })

      setCertificationTitle(payload?.certificationTitle ?? "")

      // Only strip the token from the URL after a confirmed success.
      window.history.replaceState({}, document.title, window.location.pathname)

      // Refresh learner data so the new certification appears immediately.
      await queryClient.invalidateQueries({ queryKey: ["learner-portal-data"] })
      await queryClient.invalidateQueries({ queryKey: ["learner-enrollments"] })

      setAccepted(true)
      toast.success("Invitation accepted", {
        description: payload?.certificationTitle
          ? `You now have access to ${payload.certificationTitle}.`
          : "Your certification access is now available.",
      })
    } catch (error) {
      const { status, message } = resolveError(error)

      // Not signed in: keep the token and send them to log in, then return.
      if (status === 401 || status === 403) {
        sessionStorage.setItem(PENDING_INVITATION_KEY, token)
        toast.info("Sign in with your invited email to accept this invitation.")
        navigate(LOGIN_ROUTE, { replace: true })
        return
      }

      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function goToLearning() {
    navigate(LEARNER_LEARNING_ROUTE, { replace: true })
  }

  if (!hasValidToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] px-5 py-10">
        <section className="w-full max-w-md rounded-xl border border-[#E0E7EF] bg-white p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50">
            <CircleAlert className="size-6 text-red-600" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-zinc-950">
            Invalid invitation link
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            This invitation link does not contain a valid token. Please use the
            complete invitation link sent to your email.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            onClick={() => navigate("/", { replace: true })}
          >
            Go to Home
          </Button>
        </section>
      </main>
    )
  }

  if (accepted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] px-5 py-10">
        <section className="w-full max-w-md rounded-xl border border-[#E0E7EF] bg-white p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="size-6 text-primary" />
          </div>
          <p className="mt-5 text-sm font-semibold text-primary">
            Invitation Accepted
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">
            You are now enrolled
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            {certificationTitle
              ? `You now have access to ${certificationTitle}. Start learning whenever you are ready.`
              : "Your certification access has been added to your REBYU account."}
          </p>
          <Button type="button" className="mt-7 w-full" onClick={goToLearning}>
            Open My Learning
          </Button>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] px-5 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-xl border border-[#E0E7EF] bg-white">
        <div className="border-b border-[#E0E7EF] bg-[#EAF3FA] px-8 py-9 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-6 text-primary" />
          </div>
          <p className="mt-5 text-sm font-semibold text-primary">
            REBYU Enterprise Invitation
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">
            You have been invited
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Accept this invitation to receive certification access from your
            organization.
          </p>
        </div>

        <div className="p-8">
          <div className="flex gap-3 border-y border-[#E0E7EF] bg-[#F6F9FC] p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Before you continue
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Make sure you are signed in using the same email address where
                this invitation was sent. An invitation can only be accepted
                once.
              </p>
            </div>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
              <p className="text-sm leading-6 text-red-700">{errorMessage}</p>
            </div>
          ) : null}

          <Button
            type="button"
            className="mt-6 w-full"
            onClick={handleAcceptInvitation}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Accepting Invitation...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>

          <p className="mt-4 text-center text-xs leading-5 text-zinc-400">
            Do not accept this invitation if it was not intended for you.
          </p>
        </div>
      </section>
    </main>
  )
}
