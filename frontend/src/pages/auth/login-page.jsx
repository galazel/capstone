import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertCircle, Loader2, LogIn } from "@/components/icons"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { roleHomePath, useAuth } from "@/context/auth-context.jsx"
import { resendVerificationCode, toSafeAuthMessage } from "@/services/authService.js"
import AuthShell from "./auth-shell.jsx"

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, user, status } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (status === "authenticated" && user?.role) {
      navigate(roleHomePath(user.role), { replace: true })
    }
  }, [navigate, status, user?.role])

  // Surfaced once when a request was rejected mid-session (token expired/revoked).
  useEffect(() => {
    if (sessionStorage.getItem("rebyu_session_expired")) {
      sessionStorage.removeItem("rebyu_session_expired")
      setError("Your session expired. Please sign in again.")
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()

    setError("")
    setPending(true)

    const cleanEmail = email.trim().toLowerCase()

    try {
      const result = await login(cleanEmail, password)

      /*
       * Cognito temporary-password flow.
       *
       * Cognito accepted the temporary password but requires the user
       * to create a permanent password before it can finish sign-in.
       */
      if (result?.needsNewPassword) {
        toast.info("Create a new password to finish activating your account.")

        navigate("/set-new-password", {
          state: {
            email: cleanEmail,
          },
        })

        return
      }

      // Cognito normal registration flow where email is still unverified.
      if (result?.needsConfirmation) {
        toast.info("Your account is not verified yet. Enter the code we emailed you.")

        await resendVerificationCode(cleanEmail).catch(() => {})

        navigate("/verify-email", {
          state: {
            email: cleanEmail,
          },
        })

        return
      }

      // Cognito reset-password flow.
      if (result?.needsPasswordReset) {
        toast.info("Reset your password before signing in.")

        navigate("/forgot-password", {
          state: {
            email: cleanEmail,
          },
        })

        return
      }

      const user = result?.user

      if (!user) {
        setError("Unable to load your account. Please try again.")
        return
      }

      toast.success(`Welcome back, ${user.displayName || user.email}.`)

      // Resume a pending invitation acceptance if the learner was sent here
      // from the invitation page after a 401.
      const pendingToken = sessionStorage.getItem("rebyu_pending_invitation_token")
      if (pendingToken) {
        sessionStorage.removeItem("rebyu_pending_invitation_token")
        navigate(`/invitations/accept?token=${encodeURIComponent(pendingToken)}`, {
          replace: true,
        })
        return
      }

      navigate(roleHomePath(user.role), { replace: true })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Login failed:", err?.name, err?.message)

      if (err?.name === "UserNotConfirmedException") {
        toast.info("Your account is not verified yet. Enter the code we emailed you.")

        await resendVerificationCode(cleanEmail).catch(() => {})

        navigate("/verify-email", {
          state: {
            email: cleanEmail,
          },
        })

        return
      }

      if (
          err?.name === "PasswordResetRequiredException" ||
          err?.name === "ResetPasswordException"
      ) {
        toast.info("Reset your password before signing in.")

        navigate("/forgot-password", {
          state: {
            email: cleanEmail,
          },
        })

        return
      }

      setError(toSafeAuthMessage(err, "Incorrect email or password."))
    } finally {
      setPending(false)
    }
  }

  if (status === "loading" || status === "authenticated") {
    return null
  }

  return (
      <AuthShell
          side="left"
          title="Sign in"
          description="Enter your account details to continue your certification review."
          footer={
            <>
              Don&apos;t have an account?{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Create one
              </Link>
            </>
          }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>

            <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-10"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Password</Label>

              <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10"
            />
          </div>

          {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
          ) : null}

          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
            ) : (
                <>
                  <LogIn className="size-4" />
                  Sign in
                </>
            )}
          </Button>
        </form>
      </AuthShell>
  )
}
