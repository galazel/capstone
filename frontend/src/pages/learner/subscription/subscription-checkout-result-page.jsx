import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { verifyCheckoutSession } from "@/services/subscriptionService.js"

/**
 * Landing page for both PayMongo redirect outcomes (success_url/cancel_url).
 * On success, calls /subscription/verify/{sessionId}, which is what actually
 * activates the subscription server-side -- this page isn't just a status
 * display, it's the primary activation trigger.
 */
export default function SubscriptionCheckoutResultPage({ canceled = false }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get("session_id")
  const [state, setState] = useState(canceled ? "canceled" : "verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (canceled) return
    if (!sessionId) {
      setState("error")
      setMessage("No checkout session was found.")
      return
    }

    let cancelled = false
    verifyCheckoutSession(sessionId)
      .then((result) => {
        if (cancelled) return
        if (result?.status === "success") {
          setState("success")
        } else {
          setState("pending")
          setMessage(result?.message ?? "Payment is still processing.")
        }
      })
      .catch((error) => {
        if (cancelled) return
        setState("error")
        setMessage(error?.response?.data?.error ?? "Could not verify your payment.")
      })

    return () => {
      cancelled = true
    }
  }, [canceled, sessionId])

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {state === "verifying" && (
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
            {state === "success" && <CheckCircle2Icon className="size-5 text-green-600" aria-hidden="true" />}
            {(state === "canceled" || state === "error") && (
              <XCircleIcon className="size-5 text-destructive" aria-hidden="true" />
            )}
            {state === "verifying" && "Confirming your payment…"}
            {state === "success" && "You're now on REBYU Pro"}
            {state === "pending" && "Payment still processing"}
            {state === "canceled" && "Checkout canceled"}
            {state === "error" && "Something went wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {state === "success" && (
            <p>Your Pro features are active. Thanks for upgrading!</p>
          )}
          {state === "pending" && <p>{message}</p>}
          {state === "canceled" && <p>You can upgrade any time from the subscription page.</p>}
          {state === "error" && <p>{message}</p>}
          <Button className="w-full" onClick={() => navigate("/learner/subscription")}>
            Back to subscription
          </Button>
          {state === "success" && (
            <Button variant="outline" className="w-full" asChild>
              <Link to="/learner/dashboard">Go to dashboard</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
