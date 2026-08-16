import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StudyPlanGenerator } from "@/pages/learner/learning/learner-study-plan.jsx"
import { STUDY_PLAN_QUERY_KEY, getActiveStudyPlan, saveStudyPlan } from "@/services/studyPlanService.js"

/**
 * Offering the study plan before a learner starts studying a certification.
 *
 * Extracted from the My Learning page, which owned the whole gate — the
 * diagnostic check, the plan lookup, the dialog and the save — as local
 * functions. The Certifications page navigates into a curriculum too, and
 * because none of this was reachable from there, clicking an enrolled
 * certification on that page went straight to the curriculum and the plan was
 * never offered. Two entry points, one of them silently missing the gate.
 *
 * Everything lives here now so both pages ask the same question and cannot
 * drift apart again.
 *
 * The lookup happens on the click, never on render: a query per card would be
 * one request per enrolled certification on every visit, to answer a question
 * that only matters once a card is clicked.
 */

/** The id, whatever shape the caller's certification object happens to be. */
function certificationIdOf(certification) {
  return String(
    certification?.certificationId ??
      certification?.id ??
      certification?.certification?.certificationId ??
      ""
  )
}

export function useStudyPlanGate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // The certification whose plan is being built, plus where the click was
  // headed, or null when the dialog is shut.
  const [planFor, setPlanFor] = useState(null)

  const savePlanMutation = useMutation({
    mutationFn: (plan) =>
      saveStudyPlan({
        certificationId: Number(planFor?.certificationId),
        goal: plan?.courseGoal ?? "Complete a full reviewer",
        // The generated plan, whole: preferences and every dated event. The
        // study calendar and the analytics board both read this back, so
        // nothing may be dropped here.
        schedule: plan,
      }),
    onSuccess: async () => {
      // Where the click was headed. Saving the plan is what opens it — read
      // before the dialog state is cleared.
      const next = planFor?.next

      toast.success("Study plan saved", {
        description: "Your schedule is on the study calendar.",
      })
      await queryClient.invalidateQueries({ queryKey: [STUDY_PLAN_QUERY_KEY] })
      setPlanFor(null)
      if (next) navigate(next)
    },
    onError: (error) => {
      toast.error("Could not save your study plan", {
        description: error?.response?.data?.message ?? error?.message ?? "Please try again.",
      })
    },
  })

  /**
   * Open a certification, offering the plan first when there isn't one.
   *
   * @param certification  the certification being opened
   * @param options.diagnosticCompleted
   *   whether the learner has sat this certification's diagnostic. The plan is
   *   built around diagnostic priorities, so there is nothing to generate from
   *   before it is done — those learners go straight through and the curriculum
   *   offers the diagnostic itself.
   * @param options.to  where the click was headed; defaults to the curriculum.
   */
  async function openCertification(certification, options = {}) {
    const certificationId = certificationIdOf(certification)
    const path = options.to ?? `/learner/learning/${certificationId}`

    if (!options.diagnosticCompleted) {
      navigate(path)
      return
    }

    try {
      const plan = await queryClient.fetchQuery({
        queryKey: [STUDY_PLAN_QUERY_KEY, certificationId],
        queryFn: () => getActiveStudyPlan(certificationId),
        staleTime: 30_000,
      })
      if (plan?.planId) {
        navigate(path)
        return
      }
    } catch (error) {
      // Logged, never swallowed: a lookup that fails invisibly looks exactly
      // like a learner who already has a plan. A plan is an offer, and it must
      // never stand between the learner and the page they asked for.
      console.warn("Study plan lookup failed; opening the certification directly.", error)
      navigate(path)
      return
    }

    setPlanFor({
      certificationId,
      title: certification?.title ?? "Untitled Certification",
      next: path,
    })
  }

  /**
   * Open the generator directly, with no navigation afterwards.
   *
   * The "Study plan" link on a card, as opposed to opening the certification:
   * the learner asked for the plan itself, so saving it should leave them where
   * they are rather than carrying them into a curriculum they did not click.
   */
  function openStudyPlanFor(certification) {
    setPlanFor({
      certificationId: certificationIdOf(certification),
      title: certification?.title ?? "Untitled Certification",
      next: null,
    })
  }

  /* Dismissing only closes. Behaviour carried over unchanged from the My
     Learning page — note that the comment there claimed dismissing also
     carried the learner on to the certification, which the code never did.
     Kept as written rather than as documented: a dialog that navigates you
     away when you close it is a worse surprise than one that simply shuts. */
  function closeStudyPlan() {
    setPlanFor(null)
  }

  const dialog = (
    <Dialog open={planFor != null} onOpenChange={(next) => (next ? null : closeStudyPlan())}>
      {/* `aria-describedby={undefined}`: the dialog carries a title only, and
          Radix warns about a missing description unless told there deliberately
          is not one. */}
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(1180px,calc(100vw-4rem))]"
      >
        <DialogHeader>
          <DialogTitle>Study plan</DialogTitle>
        </DialogHeader>

        {planFor ? (
          <StudyPlanGenerator
            lockedCertification={planFor.title}
            certificationId={planFor.certificationId}
            generating={savePlanMutation.isPending}
            onPlanGenerated={(plan) => savePlanMutation.mutate(plan)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )

  return { openCertification, openStudyPlanFor, closeStudyPlan, planFor, studyPlanDialog: dialog }
}
