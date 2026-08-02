import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AlertCircle, KeyRound, Loader2 } from "@/components/icons"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { roleHomePath, useAuth } from "@/context/auth-context.jsx"
import { toSafeAuthMessage } from "@/services/authService.js"

import AuthShell from "./auth-shell.jsx"

export default function SetNewPasswordPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { setNewPassword } = useAuth()

    const email = location.state?.email ?? ""

    const [newPassword, setNewPasswordValue] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState("")
    const [pending, setPending] = useState(false)

    /*
     * The Cognito temporary-password challenge must start from LoginPage.
     * Going directly here, or refreshing this page, loses the sign-in flow.
     */
    useEffect(() => {
        if (!email) {
            toast.info("Sign in with your temporary password first.")
            navigate("/login", { replace: true })
        }
    }, [email, navigate])

    async function handleSubmit(event) {
        event.preventDefault()

        setError("")

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }

        setPending(true)

        try {
            const result = await setNewPassword(newPassword)

            if (!result?.user) {
                throw new Error(
                    "Your password was created, but your account profile could not be loaded.",
                )
            }

            toast.success("Your password was created successfully.")

            navigate(roleHomePath(result.user.role), {
                replace: true,
            })
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("New password setup failed:", {
                name: err?.name,
                message: err?.message,
                code: err?.code,
                fullError: err,
            })

            const errorMessage = toSafeAuthMessage(
                err,
                "Unable to create your password. Check the password requirements and try again.",
            )
            console.error("Final error message:", errorMessage)
            setError(errorMessage)
        } finally {
            setPending(false)
        }
    }

    if (!email) {
        return null
    }

    return (
        <AuthShell
            title="Create your password"
            description={`Set a permanent password for ${email}.`}
            footer={
                <>
                    Need to sign in again?{" "}
                    <Link to="/login" className="font-medium text-primary hover:underline">
                        Return to login
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Your temporary password can only be used once. Create a new permanent
                    password to activate your account.
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>

                    <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={newPassword}
                        onChange={(event) => setNewPasswordValue(event.target.value)}
                        placeholder="Create a strong password"
                        className="h-10"
                    />

                    <p className="text-xs text-muted-foreground">
                        Follow the password rules configured in your Cognito User Pool.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm new password</Label>

                    <Input
                        id="confirm-new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Enter the same password again"
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
                            Creating password...
                        </>
                    ) : (
                        <>
                            <KeyRound className="size-4" />
                            Set new password
                        </>
                    )}
                </Button>
            </form>
        </AuthShell>
    )
}