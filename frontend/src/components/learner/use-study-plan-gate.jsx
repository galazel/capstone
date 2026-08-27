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
import {
  OVERALL_CERTIFICATION_LABEL,
  StudyPlanGenerator,
} from "@/pages/learner/learning/learner-study-plan.jsx"
import {
  STUDY_PLAN_QUERY_KEY,
  getActiveStudyPlan,
  getOverallStudyPlan,
  saveStudyPlan,
} from "@/services/studyPlanService.js"

/**
 * The study-plan generator, and the one way into it.
 *
 * There used to be six: a gate before opening a certification, a full-page
 * block on the curriculum, a button on the certification page, two tiles, and
 * the calendar. They asked the same question in different words at different
 * moments, and two of them refused to let the learner past until they answered.
 *
 * Now a plan is built in exactly one place -- the analytics board -- and
 * offered in exactly one moment: after the diagnostic, which is what the plan
 * is built from. Everywhere else links there rather than growing its own copy.
 *
 * `openCertification` stays only because several pages call it to open a
 * course; it no longer has anything to do with plans.
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
        /* Null, not `Number(null)`, for an overall plan. The backend reads a
           null certificationId as "spans every certification"; `Number(null)`
           is 0, which would be stored as a plan for certification zero -- a
           certification that does not exist, so the plan would be invisible
           everywhere afterwards. */
        certificationId: planFor?.certificationId
          ? Number(planFor.certificationId)
          : null,
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

      /* Closed first, before anything that can wait.
       *
       * This used to await `invalidateQueries` and close afterwards, which
       * meant the dialog stayed open for as long as the refetches took --
       * and `invalidateQueries` awaits *every* active query under this key.
       * That is now several, including the scheduler's, which is mounted on
       * every learner page. One slow refetch and the learner saw the success
       * toast sitting on top of a modal that would not go away, with no way
       * to tell whether the save had worked.
       *
       * The save is already done by this point. Nothing about closing depends
       * on the refetch, so nothing about closing should wait for it.
       */
      setPlanFor(null)

      toast.success("Study plan saved", {
        description: "Your schedule is on the study calendar.",
      })

      /* Dropped from the cache rather than refetched-and-awaited.
       *
       * The destination may gate on having a plan, so it must not read a stale
       * "no plan yet" and bounce the learner back to the generator they just
       * finished. Invalidating fixes that but makes saving feel slow: it
       * refetches every active plan query and waits for all of them, and
       * against a remote database that is seconds -- including `my-plans`,
       * which returns every plan's full schedule and is mounted on every
       * learner page.
       *
       * Removing the entries achieves the same guarantee for free. There is no
       * stale answer left to act on, so the gate on the next page starts with
       * no data, reports `isLoading`, and waits for a fresh one -- while
       * anything still mounted refetches in the background. Nothing here has
       * to be awaited, so the save is over the moment the server says so.
       */
      queryClient.removeQueries({ queryKey: [STUDY_PLAN_QUERY_KEY] })

      if (next) navigate(next)
    },
    onError: (error) => {
      toast.error("Could not save your study plan", {
        description: error?.response?.data?.message ?? error?.message ?? "Please try again.",
      })
    },
  })

  /**
   * Does this learner have a study plan at all?
   *
   * Coverage is deliberately not part of this test. It used to be: an overall
   * plan only counted if it named this certification, so enrolling in a new one
   * put the learner back in front of the generator -- asked to build a plan
   * they had already built, on a screen that only builds overall plans, whose
   * result replaces the plan they had. The next enrolment would ask again.
   *
   * A learner is asked for a plan once, when they have none. Adding a new
   * certification to an existing plan is an edit, and edits belong on the
   * analytics board where the plan lives -- not in a dialog thrown in front of
   * somebody who clicked Continue.
   *
   * Read against the same cache keys the curriculum page and the analytics
   * board use, and now the same question, so all three agree. When they did
   * not, one page thought a learner was unplanned and sent them to another that
   * thought they were planned and sent them back.
   */
  async function existingPlan(certificationId) {
    const scoped = await queryClient.fetchQuery({
      queryKey: [STUDY_PLAN_QUERY_KEY, String(certificationId ?? "")],
      queryFn: () => getActiveStudyPlan(certificationId),
      staleTime: 60_000,
    })
    if (scoped?.planId) return scoped

    const overall = await queryClient.fetchQuery({
      queryKey: [STUDY_PLAN_QUERY_KEY, "overall"],
      queryFn: getOverallStudyPlan,
      staleTime: 60_000,
    })
    return overall?.planId ? overall : null
  }

  /**
   * Opens a certification, asking for a plan first when there is not one.
   *
   * <p>The generator opens *here*, over the page the learner is already on,
   * rather than sending them to the analytics board to build one. It is the
   * same generator either way -- one dialog, one save path -- but a click on
   * "Continue" should be answered where it was made, not by a redirect to
   * somewhere else with the real answer another click away.
   *
   * <p>Saving carries them on to the course they were opening.
   *
   * @param options.diagnosticCompleted
   *   whether this certification's diagnostic is done. A plan is built from its
   *   priorities, so before it there is nothing to generate: those learners go
   *   straight through, and the curriculum offers the diagnostic itself.
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
      if (await existingPlan(certificationId)) {
        navigate(path)
        return
      }
    } catch (error) {
      /* Never swallowed, and never a blocker: a lookup that fails invisibly
         looks exactly like a learner who has no plan, and would hold them at a
         generator they may not need. */
      console.warn("Study plan lookup failed; opening the certification directly.", error)
      navigate(path)
      return
    }

    openOverallStudyPlan(path)
  }

  /**
   * @param next  where the learner was heading when the plan was asked for.
   *   Saving carries them on there, so a plan required before studying reads as
   *   a step on the way rather than a door slammed in front of them. Omitted
   *   when the generator was opened for its own sake.
   */
  function openOverallStudyPlan(next = null) {
    setPlanFor({
      certificationId: null,
      overall: true,
      title: OVERALL_CERTIFICATION_LABEL,
      next: typeof next === "string" ? next : null,
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
          <DialogTitle>{planFor?.overall ? "Overall study plan" : "Study plan"}</DialogTitle>
        </DialogHeader>

        {planFor ? (
          <StudyPlanGenerator
            /* An overall plan has neither: no certification to lock the form
               to, and no id to read one certification's priorities against --
               it pools them from every enrolled certification instead. */
            lockedCertification={planFor.overall ? undefined : planFor.title}
            certificationId={planFor.overall ? null : planFor.certificationId}
            overall={Boolean(planFor.overall)}
            generating={savePlanMutation.isPending}
            onPlanGenerated={(plan) => savePlanMutation.mutate(plan)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )

  return {
    openCertification,
    openOverallStudyPlan,
    closeStudyPlan,
    planFor,
    studyPlanDialog: dialog,
  }
}
