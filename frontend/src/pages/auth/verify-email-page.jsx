import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  confirmRegistration,
  resendVerificationCode,
  toSafeAuthMessage,
} from "@/services/authService.js"
import AuthShell from "./auth-shell.jsx"

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

  const [email, setEmail] = useState(presetEmail)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setPending(true)
    try {
      await confirmRegistration(email.trim(), code.trim())
      toast.success("Email verified. You can sign in now.")
      navigate("/login", { replace: true })
    } catch (err) {
      setError(
        toSafeAuthMessage(err, "Your verification code is invalid or expired.")
      )
    } finally {
      setPending(false)
    }
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
      description="Enter the verification code we sent to your inbox."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="verify-email">Email</Label>
          {/* `readOnly`, not `disabled`: a disabled input is dropped from form
              submission and skipped by keyboard navigation, so the address
              would vanish from the payload and screen readers would never
              announce it. Read-only keeps it submitted, focusable and read
              aloud, while refusing edits. */}
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            required
            readOnly={emailLocked}
            aria-describedby={emailLocked ? "verify-email-hint" : undefined}
            className={
              emailLocked
                ? "bg-muted text-muted-foreground focus-visible:ring-0"
                : undefined
            }
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {emailLocked ? (
            <p id="verify-email-hint" className="text-xs text-muted-foreground">
              We sent your code to this address.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="verify-code">Verification code</Label>
          <Input
            id="verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
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
