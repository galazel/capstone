import React, { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"
import { isSoundEnabled, setSoundEnabled, playAchievementChime } from "@/lib/sound.js"
import {
  Bell,
  Bot,
  Award,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  KeyRound,
  LockKeyhole,
  Mail,
  Shield,
  Sparkles,
  UserRound,
  Coins,
  LogOut,
} from "@/components/icons"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"
import { updateLearner, updateUser } from "@/services/learnerService.js"
import { achievementBadge } from "@/lib/achievements.js"
import {
  convertCoinsToAiCredits,
  getMyRewardBalance,
  getMyRewardLedger,
} from "@/services/gamificationService.js"
import {
  NOTIFICATION_PREFERENCE_KEY,
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
} from "@/services/notificationPreferenceService.js"
import { changePassword, signOutEverywhere } from "@/services/authService.js"
import { cancelSubscription, getLearnerSubscription } from "@/services/subscriptionService.js"

const ACCOUNT_TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "account", label: "Account", icon: CircleUserRound },
  { id: "ai", label: "AI & usage", icon: Bot },
  { id: "billing", label: "Plan & billing", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
]

/* The server's own defaults, mirrored so the switches have something to draw
   before the first read lands. Field names are the entity's. */
const DEFAULT_PREFERENCES = {
  dailyReminder: true,
  dailyReminderTime: "09:00",
  streakReminder: true,
  socialNotifications: true,
  achievementNotifications: true,
}

function ledgerLabel(reason) {
  switch (reason) {
    case "PRO_MONTHLY_GRANT":
      return "Monthly Pro credits"
    case "COIN_TO_AI_CONVERSION":
      return "Converted from coins"
    case "AI_GENERATION":
      return "AI generation"
    default:
      return String(reason ?? "Activity").replaceAll("_", " ").toLowerCase()
  }
}

function initials(name) {
  return String(name || "Learner")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function achievementTitle(achievement) {
  return achievement?.title ?? achievement?.achievementTitle ?? achievement?.name ?? "Achievement"
}

function achievementDescription(achievement) {
  return achievement?.description ?? achievement?.achievementDescription ?? "Learning milestone earned in REBYU."
}

function AchievementMark({ achievement }) {
  const image = achievementBadge(achievement)
  // Locked badges are shown, not hidden: what is left to earn is half of why a
  // badge wall is worth looking at. They read as unreachable through the
  // greyscale/opacity treatment rather than by being absent.
  const earned = achievement?.earned !== false
  return (
    <div
      className="group min-w-0 text-center"
      title={`${achievementDescription(achievement)}${earned ? "" : " (locked)"}`}
    >
      <div
        className={`mx-auto flex size-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40 transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md ${
          earned ? "" : "opacity-40 grayscale"
        }`}
      >
        {image ? <img src={image} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" /> : <Award className="size-9 text-primary" aria-hidden="true" />}
      </div>
      <p className={`mt-2 truncate text-xs font-medium ${earned ? "text-foreground" : "text-muted-foreground"}`}>{achievementTitle(achievement)}</p>
      {achievement?.earnedAt ? <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(achievement.earnedAt).toLocaleDateString()}</p> : null}
    </div>
  )
}

function SectionHeader({ title, description }) {
  return (
    <div className="border-b px-5 py-4 sm:px-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

function PreferenceRow({ title, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b px-5 py-4 last:border-b-0 sm:px-6">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export default function LearnerAccountPage() {
  const { data } = useOutletContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const entitlements = useLearnerEntitlements()

  /* Read once into state rather than calling `isSoundEnabled()` during render:
     localStorage is outside React, so a bare read would not re-render the
     switch when it changed and the control would fight the user. */
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())

  const toggleSound = (value) => {
    setSoundOn(value)
    setSoundEnabled(value)
    /* Turning it on plays it. A toggle for something you cannot hear from the
       settings page is a toggle you have to earn an achievement to test, and
       the press is itself the gesture the autoplay policy wants. */
    if (value) playAchievementChime()
  }
  const learner = data.learner
  const user = data.user
  const fullName =
    [learner?.firstName, learner?.lastName].filter(Boolean).join(" ") ||
    learner?.username ||
    "Learner"

  const [activeTab, setActiveTab] = useState("profile")
  const [form, setForm] = useState({
    firstName: learner?.firstName ?? "",
    lastName: learner?.lastName ?? "",
    username: learner?.username ?? "",
    email: user?.email ?? "",
    phoneNumber: user?.phoneNumber ?? "",
  })

  /* Everything the other tabs act on, read from the server rather than
     described in prose. The three tabs below used to be text: "usage is not
     tracked", "password changes are managed by your provider" -- true
     sentences about endpoints that exist. */
  const balanceQuery = useQuery({
    queryKey: ["learner-reward-balance"],
    queryFn: getMyRewardBalance,
    staleTime: 30_000,
  })

  const ledgerQuery = useQuery({
    queryKey: ["learner-reward-ledger"],
    queryFn: getMyRewardLedger,
    staleTime: 30_000,
  })

  const preferencesQuery = useQuery({
    queryKey: [NOTIFICATION_PREFERENCE_KEY, "me"],
    queryFn: getMyNotificationPreferences,
    staleTime: 60_000,
  })

  const subscriptionQuery = useQuery({
    queryKey: ["learner-subscription", learner?.learnerId ?? null],
    queryFn: () => getLearnerSubscription(learner.learnerId),
    enabled: learner?.learnerId != null,
    staleTime: 60_000,
    /* A learner who has never subscribed has no row to read, and retrying that
       three times is three requests to learn the same "no" twice more. The tab
       renders fully without it -- entitlements carry the plan. */
    retry: false,
  })

  const preferences = preferencesQuery.data ?? DEFAULT_PREFERENCES

  useEffect(() => {
    setForm({
      firstName: learner?.firstName ?? "",
      lastName: learner?.lastName ?? "",
      username: learner?.username ?? "",
      email: user?.email ?? "",
      phoneNumber: user?.phoneNumber ?? "",
    })
  }, [learner, user])

  const canSave = Boolean(learner?.learnerId && user?.userId)
  const featureList = useMemo(() => [...entitlements.features].sort(), [entitlements.features])
  // The whole catalog, earned first -- the count beside the header is the
  // earned ones, not the size of the catalog.
  const achievements = Array.isArray(data?.achievements) ? data.achievements : []
  const earnedAchievements = achievements.filter((achievement) => achievement.earned)
  const orderedAchievements = [
    ...earnedAchievements,
    ...achievements.filter((achievement) => !achievement.earned),
  ]

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canSave) throw new Error("Your learner profile could not be resolved.")

      await updateUser(user.userId, {
        ...user,
        email: form.email,
        phoneNumber: form.phoneNumber,
      })
      await updateLearner(learner.learnerId, {
        ...learner,
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
      })
    },
    onSuccess: async () => {
      toast.success("Profile updated")
      await queryClient.invalidateQueries({ queryKey: ["learner-portal-data"] })
    },
    onError: (error) => {
      toast.error("Could not update profile", {
        description: error?.response?.data?.message || error?.message || "Please try again.",
      })
    },
  })

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  /* The endpoint replaces all five fields from the body, so a single toggle
     still sends the whole set -- sending one field would reset the other four
     to whatever the request left null. */
  const preferenceMutation = useMutation({
    mutationFn: (next) => updateMyNotificationPreferences(next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: [NOTIFICATION_PREFERENCE_KEY, "me"] })
      const previous = queryClient.getQueryData([NOTIFICATION_PREFERENCE_KEY, "me"])
      queryClient.setQueryData([NOTIFICATION_PREFERENCE_KEY, "me"], next)
      return { previous }
    },
    onError: (error, _next, context) => {
      queryClient.setQueryData([NOTIFICATION_PREFERENCE_KEY, "me"], context?.previous)
      toast.error("Could not save that preference", {
        description: error?.response?.data?.message || error?.message || "Please try again.",
      })
    },
    onSuccess: (saved) => {
      queryClient.setQueryData([NOTIFICATION_PREFERENCE_KEY, "me"], saved)
    },
  })

  const updatePreference = (field, value) => {
    preferenceMutation.mutate({ ...preferences, [field]: value })
  }

  const [coinsToConvert, setCoinsToConvert] = useState("")

  const conversionMutation = useMutation({
    /* The idempotency key is the server's protection against a double-tap
       spending the coins twice; it has to be new per attempt, not per render. */
    mutationFn: (coins) =>
        convertCoinsToAiCredits(coins, `convert-${learner?.learnerId ?? "me"}-${Date.now()}`),
    onSuccess: async (result) => {
      if (result?.converted === false) {
        toast.info("Nothing was converted", {
          description: "That is not enough coins for a single AI credit.",
        })
      } else {
        toast.success(
            `${result?.aiCreditsReceived ?? 0} AI credit${
                result?.aiCreditsReceived === 1 ? "" : "s"
            } added`
        )
      }
      setCoinsToConvert("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["learner-reward-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["learner-reward-ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["learner-portal-data"] }),
      ])
    },
    onError: (error) => {
      toast.error("Could not convert coins", {
        description: error?.response?.data?.message || error?.message || "Please try again.",
      })
    },
  })

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const passwordMutation = useMutation({
    mutationFn: () =>
        changePassword(passwordForm.oldPassword, passwordForm.newPassword),
    onSuccess: () => {
      toast.success("Password changed")
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" })
    },
    onError: (error) => {
      toast.error("Could not change your password", {
        description:
            error?.message ||
            "Check your current password and try again.",
      })
    },
  })

  const signOutEverywhereMutation = useMutation({
    mutationFn: signOutEverywhere,
    onSuccess: () => {
      toast.success("Signed out on every device")
      navigate("/login", { replace: true })
    },
    onError: (error) => {
      toast.error("Could not sign out everywhere", {
        description: error?.message || "Please try again.",
      })
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async () => {
      toast.success("Subscription cancelled", {
        description: "You keep premium access until the end of the paid period.",
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["learner-subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["learner-entitlements"] }),
      ])
      entitlements.refetch?.()
    },
    onError: (error) => {
      toast.error("Could not cancel the subscription", {
        description: error?.response?.data?.message || error?.message || "Please try again.",
      })
    },
  })

  const renderContent = () => {
    if (activeTab === "profile") {
      return (
        <form
          className="border-y border-border/70 bg-background"
          onSubmit={(event) => {
            event.preventDefault()
            saveMutation.mutate()
          }}
        >
          <SectionHeader title="Profile details" description="Update how your learner identity appears across REBYU." />
          <div className="p-5 sm:p-6">
            <section className="border-b border-border/70 pb-6">
              <div className="flex items-end justify-between gap-4">
                <div><h3 className="text-base font-semibold">Achievements</h3><p className="mt-1 text-sm text-muted-foreground">Milestones earned through lessons, assessments, and learning streaks.</p></div>
                <span className="text-sm font-medium text-muted-foreground">{earnedAchievements.length} of {achievements.length} earned</span>
              </div>
              {achievements.length ? (
                <div className="mt-5 grid grid-cols-3 gap-5 sm:grid-cols-5 lg:grid-cols-8">
                  {orderedAchievements.map((achievement, index) => <AchievementMark key={achievement.code ?? achievement.achievementId ?? `${achievementTitle(achievement)}-${index}`} achievement={achievement} />)}
                </div>
              ) : (
                <div className="mt-5 flex items-center gap-3 py-3 text-sm text-muted-foreground"><span className="flex size-10 items-center justify-center rounded-full bg-muted"><Award className="size-5" /></span>Complete lessons and assessments to earn your first achievement.</div>
              )}
            </section>
            <div className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">First name</span>
                <Input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} disabled={!canSave} required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Last name</span>
                <Input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} disabled={!canSave} required />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium">Username</span>
                <Input value={form.username} onChange={(e) => updateField("username", e.target.value)} disabled={!canSave} required />
                <span className="block text-xs text-muted-foreground">Used across your learner activity.</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end border-t bg-muted/20 px-5 py-4 sm:px-6">
            <Button disabled={!canSave || saveMutation.isPending} type="submit">
              {saveMutation.isPending ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      )
    }

    if (activeTab === "account") {
      return (
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          <SectionHeader title="Account information" description="Contact details connected to your authenticated account." />
          <div className="grid gap-5 p-5 sm:p-6">
            <label className="max-w-xl space-y-2">
              <span className="text-sm font-medium">Email address</span>
              <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} disabled={!canSave} required />
            </label>
            <label className="max-w-xl space-y-2">
              <span className="text-sm font-medium">Phone number</span>
              <Input value={form.phoneNumber} onChange={(e) => updateField("phoneNumber", e.target.value)} disabled={!canSave} placeholder="Add a phone number" />
            </label>
          </div>
          <div className="flex justify-end border-t bg-muted/20 px-5 py-4 sm:px-6">
            <Button disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving..." : "Save account"}
            </Button>
          </div>
        </div>
      )
    }

    if (activeTab === "ai") {
      const balance = balanceQuery.data
      const ledger = Array.isArray(ledgerQuery.data) ? ledgerQuery.data : []
      const creditEntries = ledger.filter((entry) => entry.currency === "AI_CREDITS")
      const spent = creditEntries
          .filter((entry) => entry.amount < 0)
          .reduce((total, entry) => total + Math.abs(entry.amount), 0)
      const coins = Number(balance?.coins ?? 0)
      const requestedCoins = Number(coinsToConvert)
      const canConvert =
          Number.isFinite(requestedCoins) &&
          requestedCoins > 0 &&
          requestedCoins <= coins &&
          !conversionMutation.isPending

      return (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-md border bg-card shadow-sm">
            <SectionHeader title="AI access" description="What your account can do, and what it has left to do it with." />
            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              <div className="rounded-md border bg-muted/20 p-4">
                <Sparkles className="size-5 text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">Access source</p>
                <p className="mt-1 font-semibold">{entitlements.accessSource.replaceAll("_", " ")}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <Bot className="size-5 text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">AI credits remaining</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {balanceQuery.isLoading ? "..." : Number(balance?.aiCredits ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <CheckCircle2 className="size-5 text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">Credits spent recently</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {ledgerQuery.isLoading ? "..." : spent.toLocaleString()}
                </p>
              </div>
            </div>
          </section>

          {/* Coins are earned by studying and are the only way a free learner
              gets AI credits, so the exchange belongs on the page that shows
              the balance rather than three clicks away. */}
          <section className="overflow-hidden rounded-md border bg-card shadow-sm">
            <SectionHeader title="Turn coins into AI credits" description="Coins earned from practice, streaks, and assessments." />
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-4 py-3">
                <Coins className="size-5 text-primary" />
                <span className="text-sm text-muted-foreground">Coin balance</span>
                <span className="font-semibold tabular-nums">
                  {balanceQuery.isLoading ? "..." : coins.toLocaleString()}
                </span>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium">Coins to convert</span>
                <Input
                    type="number"
                    min={1}
                    max={coins || undefined}
                    value={coinsToConvert}
                    onChange={(event) => setCoinsToConvert(event.target.value)}
                    className="w-40"
                    placeholder="0"
                />
              </label>

              <Button
                  type="button"
                  disabled={!canConvert}
                  onClick={() => conversionMutation.mutate(Math.floor(requestedCoins))}
              >
                {conversionMutation.isPending ? "Converting..." : "Convert"}
              </Button>
            </div>
          </section>

          <section className="overflow-hidden rounded-md border bg-card shadow-sm">
            <SectionHeader title="Recent credit activity" description="Grants, conversions, and generations on this account." />
            {creditEntries.length ? (
              <ul className="divide-y">
                {creditEntries.map((entry, index) => (
                  <li
                      key={`${entry.createdAt}-${index}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ledgerLabel(entry.reason)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
                      </p>
                    </div>
                    <span
                        className={`text-sm font-semibold tabular-nums ${
                            entry.amount < 0 ? "text-muted-foreground" : "text-primary"
                        }`}
                    >
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted-foreground sm:p-6">
                {ledgerQuery.isLoading
                    ? "Loading your credit activity..."
                    : "No AI credit activity yet."}
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-md border bg-card shadow-sm">
            <SectionHeader title="Included AI capabilities" description="Features reported by the current entitlement service." />
            <div className="p-5 sm:p-6">
              {featureList.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {featureList.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 rounded border px-3 py-2.5 text-sm">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span>{feature.replaceAll("_", " ")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No premium AI entitlements are attached to this account.</p>
              )}
            </div>
          </section>
        </div>
      )
    }

    if (activeTab === "billing") {
      const subscription = subscriptionQuery.data
      const canCancel =
          entitlements.personalProActive && !entitlements.cancelAtPeriodEnd

      return (
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          <SectionHeader title="Plan and billing" description="Your personal or organization-sponsored learning access." />
          <div className="p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-5 rounded-md border bg-muted/20 p-5 sm:flex-row sm:items-center">
              <div>
                <Badge>{entitlements.personalPlanCode}</Badge>
                <h3 className="mt-3 text-lg font-semibold">{entitlements.hasPremium ? "Premium learning access" : "Free learner access"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entitlements.institutionalActive
                    ? "Your organization currently sponsors eligible certification features."
                    : entitlements.personalProActive
                      ? "Your personal subscription is active."
                      : "Upgrade to access premium learning and AI capabilities."}
                </p>
                {entitlements.currentPeriodEnd ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {entitlements.cancelAtPeriodEnd ? "Access ends" : "Current period ends"}{" "}
                    {new Date(entitlements.currentPeriodEnd).toLocaleDateString()}.
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                <Button onClick={() => navigate("/learner/subscription")}>
                  {entitlements.hasPremium ? "Manage plan" : "See plans"}
                  <ChevronRight className="ml-1 size-4" />
                </Button>

                {/* Cancelling is the one billing action that belongs here
                    rather than on the plans page: it needs no plan choice, and
                    it is what someone opens account settings to do. */}
                {canCancel ? (
                  <Button
                      variant="outline"
                      disabled={cancelSubscriptionMutation.isPending}
                      onClick={() => cancelSubscriptionMutation.mutate()}
                  >
                    {cancelSubscriptionMutation.isPending
                        ? "Cancelling..."
                        : "Cancel subscription"}
                  </Button>
                ) : null}
              </div>
            </div>

            {subscription ? (
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-md border bg-muted/20 p-4">
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1 font-semibold capitalize">
                    {String(subscription.status ?? "-").toLowerCase()}
                  </dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-4">
                  <dt className="text-xs text-muted-foreground">Plan</dt>
                  <dd className="mt-1 font-semibold">
                    {subscription.planCode ?? subscription.plan?.code ?? "-"}
                  </dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-4">
                  <dt className="text-xs text-muted-foreground">Renews</dt>
                  <dd className="mt-1 font-semibold">
                    {subscription.currentPeriodEnd
                        ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                        : "-"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </div>
      )
    }

    if (activeTab === "notifications") {
      return (
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          <SectionHeader
              title="Notification preferences"
              description="Saved to your account, so they follow you to every device."
          />

          <PreferenceRow
              title="Daily study reminder"
              description="A nudge to study at the time you choose."
              checked={Boolean(preferences.dailyReminder)}
              onCheckedChange={(value) => updatePreference("dailyReminder", value)}
          />

          {preferences.dailyReminder ? (
            <div className="flex items-center justify-between gap-6 border-b px-5 py-4 sm:px-6">
              <div>
                <p className="text-sm font-medium text-foreground">Reminder time</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  When the daily reminder is sent.
                </p>
              </div>
              <Input
                  type="time"
                  className="w-36"
                  value={preferences.dailyReminderTime ?? "09:00"}
                  onChange={(event) =>
                      updatePreference("dailyReminderTime", event.target.value)
                  }
              />
            </div>
          ) : null}

          <PreferenceRow
              title="Streak reminder"
              description="A warning before a study streak is about to break."
              checked={Boolean(preferences.streakReminder)}
              onCheckedChange={(value) => updatePreference("streakReminder", value)}
          />

          <PreferenceRow
              title="Achievement notifications"
              description="Tell me when I unlock an achievement."
              checked={Boolean(preferences.achievementNotifications)}
              onCheckedChange={(value) =>
                  updatePreference("achievementNotifications", value)
              }
          />

          <PreferenceRow
              title="Community notifications"
              description="Replies and activity on posts and study sets you follow."
              checked={Boolean(preferences.socialNotifications)}
              onCheckedChange={(value) =>
                  updatePreference("socialNotifications", value)
              }
          />

          {/* Not one of the four above: those are account preferences that
              travel with the learner, and this one is a property of the device
              in front of them. Muting a shared laptop should not mute the phone
              they study on. It is here because this is where a learner comes
              looking for "stop making noise at me", not because it shares their
              storage. */}
          <PreferenceRow
            title="Achievement sound"
            description="Play a short chime when you unlock an achievement. Saved on this device only."
            checked={soundOn}
            onCheckedChange={toggleSound}
          />
        </div>
      )
    }

    const passwordsMatch =
        passwordForm.newPassword === passwordForm.confirmPassword
    const canChangePassword =
        passwordForm.oldPassword.length > 0 &&
        passwordForm.newPassword.length >= 8 &&
        passwordsMatch &&
        !passwordMutation.isPending

    return (
      <div className="space-y-4">
        <section className="overflow-hidden rounded-md border bg-card shadow-sm">
          <SectionHeader title="Change password" description="Your current password is required, so a borrowed session cannot change it." />
          <form
              className="grid max-w-xl gap-4 p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault()
                passwordMutation.mutate()
              }}
          >
            <label className="space-y-2">
              <span className="text-sm font-medium">Current password</span>
              <Input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.oldPassword}
                  onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        oldPassword: event.target.value,
                      }))
                  }
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">New password</span>
              <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                  }
              />
              <span className="block text-xs text-muted-foreground">
                At least 8 characters.
              </span>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Confirm new password</span>
              <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                  }
              />
              {passwordForm.confirmPassword && !passwordsMatch ? (
                <span className="block text-xs font-medium text-destructive">
                  The two new passwords do not match.
                </span>
              ) : null}
            </label>

            <div className="flex justify-end">
              <Button type="submit" disabled={!canChangePassword}>
                {passwordMutation.isPending ? "Changing..." : "Change password"}
              </Button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-md border bg-card shadow-sm">
          <SectionHeader title="Sessions" description="Where this account is signed in." />
          <div className="divide-y">
            <div className="flex gap-4 p-5 sm:p-6">
              <Mail className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Verified identity</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Signed in as {user?.email || data.identity?.email || "your learner account"}.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div className="flex gap-4">
                <LockKeyhole className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Sign out everywhere</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ends every session on every device, including this one. Use
                    this if you signed in somewhere you no longer have.
                  </p>
                </div>
              </div>

              <Button
                  variant="outline"
                  disabled={signOutEverywhereMutation.isPending}
                  onClick={() => signOutEverywhereMutation.mutate()}
              >
                <LogOut className="mr-2 size-4" />
                {signOutEverywhereMutation.isPending ? "Signing out..." : "Sign out everywhere"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="border-b border-border/70">
        <div className="flex flex-col gap-5 pb-6 sm:flex-row sm:items-center">
          <Avatar className="size-24 border border-border shadow-sm">
            <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">{initials(fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-heading text-2xl font-semibold tracking-tight">{fullName}</p>
            <p className="mt-1 truncate text-base text-muted-foreground">@{learner?.username || "learner"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="secondary">Learner</Badge><span className="text-sm text-muted-foreground">{user?.email || "Learner account"}</span></div>
          </div>
        </div>

        <nav className="flex overflow-x-auto" aria-label="Account settings">
          {ACCOUNT_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition ${active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"}`}
              >
                <Icon className="size-4" />{tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="min-w-0">{renderContent()}</main>
    </div>
  )
}
