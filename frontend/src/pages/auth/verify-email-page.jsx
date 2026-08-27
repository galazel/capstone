import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OtpInput } from "@/components/ui/otp-input.jsx"
import {
  confirmRegistration,
  resendVerificationCode,
  toSafeAuthMessage,
} from "@/services/authService.js"
import AuthShell from "./auth-shell.jsx"

/** Cognito issues six-digit confirmation codes. */
const CODE_LENGTH = 6

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()

  /* The address is carried over from registration. When it is there, the field
     is shown but not editable: the code was sent to that specific address, so
     letting it be typed over only produces a confirmation attempt against an
     account the code was never issued for -- which fails with a message about
     the code rather than about the address, and reads as a broken code.

     Still editable when nothing was carried over, which happens when someone
     opens /verify-email directly or reloads the page. Locking an empty box
     would strand them with no way to proceed. */
  const presetEmail = location.state?.email ?? ""
  const emailLocked = presetEmail !== ""

  const [typedEmail, setTypedEmail] = useState("")

  /* The address in play. When one was carried over it is read straight from
     the location every render, never copied into state: `emailLocked` is
     derived from the location and the address was not, so the two could
     disagree -- and the failing shape is a page that says "We sent a code to"
     with nothing after it. One source, so they cannot drift. */
  const email = emailLocked ? presetEmail : typedEmail
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)

  /**
   * Verifies one code.
   *
   * Takes the code as an argument rather than reading it from state, because
   * the auto-submit cannot wait for state. The OTP field hands the finished
   * code to `onComplete` in the same tick it reports the change, so a handler
   * reading `code` there sees the value from *before* the last digit -- it was
   * submitting five digits of six and Cognito was rejecting every one of them
   * as invalid, which no amount of resending could fix.
   */
  const verify = async (submitted) => {
    const value = String(submitted ?? "").trim()
    if (pending || !value) return

    setError("")
    setPending(true)
    try {
      await confirmRegistration(email.trim(), value)
      toast.success("Email verified. You can sign in now.")
      navigate("/login", { replace: true })
    } catch (err) {
      /* No code-specific fallback here. `toSafeAuthMessage` already names the
         code errors precisely; anything it cannot map is not known to be about
         the code at all, and saying so sends the learner back to re-enter a
         code that was fine. */
      setError(toSafeAuthMessage(err))
      // Cleared on failure: a rejected code has to be retyped anyway, and
      // leaving it sitting there means the first keystroke lands on a full row
      // of boxes and does nothing.
      setCode("")
    } finally {
      setPending(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    verify(code)
  }

  const handleResend = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.")
      return
    }
    setResending(true)
    try {
      await resendVerificationCode(email.trim())
      toast.success("A new verification code was sent to your email.")
    } catch (err) {
      setError(toSafeAuthMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      /* The inbox is no longer mentioned here: the line above the boxes now
         names the exact address, and saying it twice in three lines pushed the
         code entry itself further down the page. */
      description="Enter the 6-digit code to finish setting up your account."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* The address is a statement, not a question. It was decided at
            registration and the code was issued against it, so a field here
            only offers a way to verify the wrong account -- which fails with a
            message about the code and reads as a broken code. */}
        {emailLocked ? (
          <p className="text-sm leading-6 text-muted-foreground">
            We sent a code to{" "}
            <span className="font-semibold text-foreground">{email}</span>
          </p>
        ) : (
          /* Nothing was carried over -- someone opened this page directly or
             reloaded it. The field stays for them, because locking an empty
             address would strand them with no way to proceed. */
          <div className="space-y-2">
            <Label htmlFor="verify-email">Email</Label>
            <Input
              id="verify-email"
              type="email"
              autoComplete="email"
              required
              value={typedEmail}
              onChange={(event) => setTypedEmail(event.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="verify-code">Verification code</Label>

          <OtpInput
            id="verify-code"
            value={code}
            onChange={setCode}
            invalid={Boolean(error)}
            disabled={pending}
            /* Submitted on the sixth digit, with the code the field just
               finished -- never with `code`, which has not been re-rendered
               yet at this point. The button stays for anyone who gets there
               another way. */
            onComplete={(value) => verify(value)}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending || code.length < CODE_LENGTH}>
          {pending ? "Verifying..." : "Verify Email"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Sending..." : "Resend code"}
        </Button>
      </form>
    </AuthShell>
  )
}
