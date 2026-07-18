import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getGamificationSettings,
  updateGamificationSettings,
} from "@/services/gamificationSettingsService"

const SECTIONS = [
  {
    title: "Practice rewards",
    description: "XP and coins granted when a learner completes each activity type.",
    fields: [
      { key: "tutorQuizXp", label: "Tutor quiz XP" },
      { key: "tutorQuizCoins", label: "Tutor quiz coins" },
      { key: "communityQuizXp", label: "Community quiz XP" },
      { key: "communityQuizCoins", label: "Community quiz coins" },
      { key: "flashcardXp", label: "Flashcard XP" },
      { key: "flashcardCoins", label: "Flashcard coins" },
    ],
  },
  {
    title: "Low-score adjustment",
    description: "Below the threshold, XP is halved (down to the minimum) and no coins are awarded.",
    fields: [
      { key: "lowScoreThresholdPercent", label: "Low-score threshold (%)", min: 0, max: 100 },
      { key: "lowScoreMinXp", label: "Minimum XP" },
    ],
  },
  {
    title: "AI credits",
    description: "Coin-to-credit conversion rate, generation cost, and the monthly Pro grant.",
    fields: [
      { key: "coinsPerAiCredit", label: "Coins per 1 AI credit", min: 1 },
      { key: "aiGenerationCost", label: "AI credits per generation" },
      { key: "monthlyProAiCredits", label: "Monthly Pro AI credits" },
    ],
  },
]

const NUMERIC_KEYS = SECTIONS.flatMap((section) => section.fields.map((f) => f.key))

export default function GamificationSettings() {
  const client = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ["gamification-settings"],
    queryFn: getGamificationSettings,
  })

  const [form, setForm] = useState(null)

  useEffect(() => {
    if (settingsQuery.data) {
      const next = {}
      for (const key of NUMERIC_KEYS) next[key] = settingsQuery.data[key] ?? 0
      setForm(next)
    }
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: (payload) => updateGamificationSettings(payload),
    onSuccess: (data) => {
      client.setQueryData(["gamification-settings"], data)
      toast.success("Gamification settings saved.")
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.message ?? "Unable to save gamification settings."
      ),
  })

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    const payload = {}
    for (const key of NUMERIC_KEYS) payload[key] = Number(form[key])
    saveMutation.mutate(payload)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="size-6 text-primary" aria-hidden="true" />
          Gamification settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tune reward amounts, the coin conversion rate, and AI credit costs. Changes apply to all
          future rewards immediately.
        </p>
      </div>

      {settingsQuery.isLoading || !form ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading settings...
        </div>
      ) : settingsQuery.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Unable to load settings. You may need admin access.
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {SECTIONS.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <Input
                      id={field.key}
                      type="number"
                      min={field.min ?? 0}
                      max={field.max}
                      value={form[field.key]}
                      onChange={(e) => setField(field.key, e.target.value)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" aria-hidden="true" />
                  Save settings
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
