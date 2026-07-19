import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, InfoIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import ProBadge from "@/components/learner/pro-badge.jsx"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"
import { getCurrentLearnerIdentity } from "@/services/learnerService.js"
import {
  cancelSubscription,
  getIndividualPlans,
  getLearnerSubscription,
  initiateCheckout,
} from "@/services/subscriptionService.js"

const FEATURE_LABELS = {
  CERTIFICATION_BROWSING: "Browse all certifications",
  LESSON_ACCESS: "Full lesson access",
  BASIC_LEARNING: "Basic learning tools",
  BASIC_COMPLETION_TRACKING: "Lesson completion tracking",
  DETAILED_PROGRESS: "Detailed progress",
  PROGRESS_ANALYTICS: "Progress analytics",
  MASTERY_ANALYTICS: "Mastery analytics",
  WEAKNESS_ANALYSIS: "Weakness analysis",
  PERSONALIZED_STUDY_PLAN: "Personalized & AI study plans",
  MOCK_EXAM_ACCESS: "Mock exams",
  BATTLES_ACCESS: "Battles",
  CHALLENGES_ACCESS: "Challenges",
  READINESS_ANALYSIS: "Readiness analysis",
  ADVANCED_RECOMMENDATIONS: "Advanced recommendations",
}

function formatMoney(amount, currency = "PHP") {
  const value = Number(amount)
  if (!Number.isFinite(value)) return "—"
  return value.toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  })
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
}

function PlanFeatures({ plan }) {
  const codes = (plan.entitlements ?? [])
    .filter((entitlement) => entitlement.enabled)
    .map((entitlement) => entitlement.entitlementCode)
    .filter((code) => FEATURE_LABELS[code])
  if (codes.length === 0) return null
  return (
    <ul className="space-y-1.5 text-sm">
      {codes.map((code) => (
        <li key={code} className="flex items-start gap-2">
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{FEATURE_LABELS[code]}</span>
        </li>
      ))}
    </ul>
  )
}

export default function LearnerSubscriptionPage() {
  const identity = getCurrentLearnerIdentity()
  const learnerId = identity?.learnerId ?? null
  const entitlements = useLearnerEntitlements()
  const queryClient = useQueryClient()
  const [redirecting, setRedirecting] = useState(false)

  const plansQuery = useQuery({
    queryKey: ["individual-plans"],
    queryFn: getIndividualPlans,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const subscriptionQuery = useQuery({
    queryKey: ["learner-subscription", learnerId],
    queryFn: () => getLearnerSubscription(learnerId),
    enabled: learnerId != null,
    retry: 1,
  })

  const plans = Array.isArray(plansQuery.data) ? plansQuery.data : []
  const freePlan = plans.find((plan) => plan.isFree)
  const proPlan = plans.find((plan) => !plan.isFree)
  const subscription = subscriptionQuery.data
  const isProActive = entitlements.personalProActive

  const checkoutMutation = useMutation({
    mutationFn: () => initiateCheckout(proPlan.subscriptionPlanId),
    onSuccess: (data) => {
      if (data?.checkout_url) {
        setRedirecting(true)
        window.location.href = data.checkout_url
      } else {
        toast.error("Could not start checkout. Please try again.")
      }
    },
    onError: () => {
      toast.error("Could not start checkout. Please try again.")
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast.success("Your subscription will not renew. Pro access continues until the end of the paid period.")
      queryClient.invalidateQueries({ queryKey: ["learner-subscription", learnerId] })
      queryClient.invalidateQueries({ queryKey: ["learner-entitlements"] })
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error ?? "Could not cancel your subscription.")
    },
  })

  const handleUpgrade = () => {
    if (!proPlan?.subscriptionPlanId) return
    checkoutMutation.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Current status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Your plan</CardTitle>
            {isProActive ? <ProBadge /> : <Badge variant="secondary">Free</Badge>}
            {entitlements.institutionalActive ? (
              <Badge variant="outline">Institution-sponsored</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="text-sm">
          {entitlements.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              Loading your entitlements…
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Current plan</dt>
                <dd className="font-medium">
                  {isProActive ? "REBYU Pro" : "Free"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Access source</dt>
                <dd className="font-medium capitalize">
                  {entitlements.accessSource.replace(/_/g, " ").toLowerCase()}
                </dd>
              </div>
              {subscription?.status ? (
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">{subscription.status}</dd>
                </div>
              ) : null}
              {subscription?.currentPeriodEnd ? (
                <div>
                  <dt className="text-muted-foreground">
                    {subscription.cancelAtPeriodEnd ? "Access until" : "Renews"}
                  </dt>
                  <dd className="font-medium">
                    {formatDate(subscription.currentPeriodEnd)}
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {freePlan ? (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{freePlan.planName}</CardTitle>
              <CardDescription>{freePlan.description}</CardDescription>
              <p className="pt-2 text-3xl font-bold">Free</p>
            </CardHeader>
            <CardContent className="flex-1">
              <PlanFeatures plan={freePlan} />
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" disabled>
                {isProActive ? "Included" : "Current plan"}
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {proPlan ? (
          <Card className="flex flex-col border-primary/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{proPlan.planName}</CardTitle>
                <ProBadge />
              </div>
              <CardDescription>{proPlan.description}</CardDescription>
              <p className="pt-2 text-3xl font-bold">
                {formatMoney(proPlan.amount, proPlan.currency)}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / month
                </span>
              </p>
            </CardHeader>
            <CardContent className="flex-1">
              <PlanFeatures plan={proPlan} />
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {isProActive && subscription?.status === "ACTIVE" && !entitlements.institutionalActive ? (
                subscription.cancelAtPeriodEnd ? (
                  <Button variant="outline" className="w-full" disabled>
                    Cancels {formatDate(subscription.currentPeriodEnd)}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? (
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      "Cancel renewal"
                    )}
                  </Button>
                )
              ) : isProActive ? (
                <Button variant="outline" className="w-full" disabled>
                  Active
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleUpgrade}
                  disabled={checkoutMutation.isPending || redirecting}
                >
                  {checkoutMutation.isPending || redirecting ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    "Upgrade to Pro"
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : null}
      </div>

      <div className="flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Payments are processed by PayMongo in test mode. Institution-sponsored
          learners get Pro features through their organization's license instead.
        </span>
      </div>
    </div>
  )
}
