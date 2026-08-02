import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertCircle, Loader2, UserPlus } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { registerAccount, toSafeAuthMessage } from "@/services/authService.js"
import AuthShell from "./auth-shell.jsx"

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setPending(true)
    try {
      await registerAccount({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      })
      toast.success("Account created. Check your email for a verification code.")
      navigate("/verify-email", { state: { email: form.email.trim() } })
    } catch (err) {
      setError(
        toSafeAuthMessage(
          err,
          "Unable to create your account. Please check your details and try again."
        )
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      compact
      // Mirrored against sign-in: the form crosses the page when you switch
      // between the two, so the change of screen is unmissable.
      side="right"
      title="Create your account"
      description="Create a learner account and begin preparing with REBYU."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FieldGroup className="gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="register-first">First name</FieldLabel>
              <Input
                id="register-first"
                autoComplete="given-name"
                required
                value={form.firstName}
                onChange={setField("firstName")}
                className="h-10"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="register-last">Last name</FieldLabel>
              <Input
                id="register-last"
                autoComplete="family-name"
                required
                value={form.lastName}
                onChange={setField("lastName")}
                className="h-10"
              />
            </Field>
          </div>
        <Field>
          <FieldLabel htmlFor="register-email">Email</FieldLabel>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={setField("email")}
            placeholder="you@example.com"
            className="h-10"
          />
          <FieldDescription>
            We use your email for sign-in, verification, and account updates.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="register-password">Password</FieldLabel>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={setField("password")}
            className="h-10"
          />
          <FieldDescription>
            At least 8 characters, with upper and lower case letters and a
            number.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="register-confirm">Confirm password</FieldLabel>
          <Input
            id="register-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={setField("confirmPassword")}
            className="h-10"
          />
          <FieldDescription>Enter the same password again.</FieldDescription>
        </Field>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                Create account
              </>
            )}
          </Button>
        </Field>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
