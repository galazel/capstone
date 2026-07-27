import React, { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"
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
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"
import { updateLearner, updateUser } from "@/services/learnerService.js"

const ACCOUNT_TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "account", label: "Account", icon: CircleUserRound },
  { id: "ai", label: "AI & usage", icon: Bot },
  { id: "billing", label: "Plan & billing", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
]

const DEFAULT_PREFERENCES = {
  learningReminders: true,
  certificationUpdates: true,
  communityReplies: true,
  productNews: false,
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

function achievementImage(achievement) {
  return achievement?.iconUrl ?? achievement?.imageUrl ?? achievement?.badgeUrl ?? null
}

function AchievementMark({ achievement }) {
  const image = achievementImage(achievement)
  return (
    <div className="group min-w-0 text-center" title={achievementDescription(achievement)}>
      <div className="mx-auto flex size-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40 transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Award className="size-9 text-primary" aria-hidden="true" />}
      </div>
      <p className="mt-2 truncate text-xs font-medium text-foreground">{achievementTitle(achievement)}</p>
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
  const [preferences, setPreferences] = useState(() => {
    try {
      return {
        ...DEFAULT_PREFERENCES,
        ...JSON.parse(localStorage.getItem("rebyu_notification_preferences") || "{}"),
      }
    } catch {
      return DEFAULT_PREFERENCES
    }
  })

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
  const achievements = Array.isArray(data?.latestAchievements)
    ? data.latestAchievements
    : Array.isArray(data?.achievements)
      ? data.achievements
      : []

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

  const updatePreference = (field, value) => {
    setPreferences((current) => {
      const next = { ...current, [field]: value }
      localStorage.setItem("rebyu_notification_preferences", JSON.stringify(next))
      return next
    })
  }

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
                <span className="text-sm font-medium text-muted-foreground">{achievements.length} earned</span>
              </div>
              {achievements.length ? (
                <div className="mt-5 grid grid-cols-3 gap-5 sm:grid-cols-5 lg:grid-cols-7">
                  {achievements.slice(0, 7).map((achievement, index) => <AchievementMark key={achievement.achievementId ?? achievement.id ?? `${achievementTitle(achievement)}-${index}`} achievement={achievement} />)}
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
                <span className="block text-xs text-muted-foreground">Used in community posts and learner activity.</span>
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
      return (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-md border bg-card shadow-sm">
            <SectionHeader title="AI access" description="AI capabilities available through your current access source." />
            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              <div className="rounded-md border bg-muted/20 p-4">
                <Sparkles className="size-5 text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">Access source</p>
                <p className="mt-1 font-semibold">{entitlements.accessSource.replaceAll("_", " ")}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <Bot className="size-5 text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">AI features</p>
                <p className="mt-1 font-semibold">{entitlements.hasPremium ? "Enabled" : "Limited"}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <CheckCircle2 className="size-5 text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">Usage this period</p>
                <p className="mt-1 font-semibold">Not tracked</p>
              </div>
            </div>
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
              <p className="mt-4 border-l-4 border-primary bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                Request and token counters are not exposed by the backend yet, so this page does not display estimated usage.
              </p>
            </div>
          </section>
        </div>
      )
    }

    if (activeTab === "billing") {
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
                  <p className="mt-2 text-xs text-muted-foreground">Current period ends {new Date(entitlements.currentPeriodEnd).toLocaleDateString()}.</p>
                ) : null}
              </div>
              <Button onClick={() => navigate("/learner/subscription")}>
                Manage plan <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === "notifications") {
      return (
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          <SectionHeader title="Notification preferences" description="Choose which learner updates you want to receive in the portal." />
          <PreferenceRow title="Learning reminders" description="Study-plan reminders and upcoming learning tasks." checked={preferences.learningReminders} onCheckedChange={(value) => updatePreference("learningReminders", value)} />
          <PreferenceRow title="Certification updates" description="New assignments, invitations, and certification changes." checked={preferences.certificationUpdates} onCheckedChange={(value) => updatePreference("certificationUpdates", value)} />
          <PreferenceRow title="Community replies" description="Replies and activity related to your community posts." checked={preferences.communityReplies} onCheckedChange={(value) => updatePreference("communityReplies", value)} />
          <PreferenceRow title="Product news" description="Occasional REBYU feature announcements." checked={preferences.productNews} onCheckedChange={(value) => updatePreference("productNews", value)} />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <section className="overflow-hidden rounded-md border bg-card shadow-sm">
          <SectionHeader title="Security" description="Authentication and account protection." />
          <div className="divide-y">
            <div className="flex gap-4 p-5 sm:p-6">
              <KeyRound className="mt-0.5 size-5 text-primary" />
              <div><p className="text-sm font-medium">Password</p><p className="mt-1 text-xs text-muted-foreground">Password changes are managed by your authentication provider.</p></div>
            </div>
            <div className="flex gap-4 p-5 sm:p-6">
              <Mail className="mt-0.5 size-5 text-primary" />
              <div><p className="text-sm font-medium">Verified identity</p><p className="mt-1 text-xs text-muted-foreground">Signed in as {user?.email || data.identity?.email || "your learner account"}.</p></div>
            </div>
            <div className="flex gap-4 p-5 sm:p-6">
              <LockKeyhole className="mt-0.5 size-5 text-primary" />
              <div><p className="text-sm font-medium">Session protection</p><p className="mt-1 text-xs text-muted-foreground">Protected learner routes require a valid authenticated session.</p></div>
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
