import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CalendarDays } from "@/components/icons"
import { STUDY_PLAN_QUERY_KEY, getActiveStudyPlan } from "@/services/studyPlanService.js"

/**
 * Offers a study plan once the diagnostic is done and there isn't one.
 *
 * <p>The diagnostic is the moment the offer is worth making: the plan is built
 * from its priority topics, so before it there is nothing to schedule, and
 * straight after it the learner has just been told what they are weak on and
 * has nowhere to put that.
 *
 * <p>It sends them to the analytics board rather than building the plan here.
 * Plan creation lives in exactly one place; a second generator on the results
 * page is how there came to be six ways in that did subtly different things.
 */
export function StudyPlanPrompt({ certificationId, enabled }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  const planQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, "active"],
    queryFn: () => getActiveStudyPlan(),
    enabled: Boolean(enabled),
    staleTime: 60_000,
  })

  // Only once the lookup has actually answered. Opening while it is in flight
  // would flash the offer at learners who already have a plan.
  const shouldOffer =
    Boolean(enabled) && planQuery.isSuccess && !planQuery.data?.planId && !dismissed

  /* A missed lookup is not a reason to nag: if the request failed we do not
     know whether they have a plan, and the honest default is to stay quiet
     rather than offer to build a second one. */
  useEffect(() => {
    if (planQuery.isError) setDismissed(true)
  }, [planQuery.isError])

  return (
    <Dialog open={shouldOffer} onOpenChange={(next) => (next ? null : setDismissed(true))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn this into a study plan</DialogTitle>
          <DialogDescription>
            Your diagnostic is done, so we know which topics to put first. A study
            plan schedules them across the days before your exam.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            className="gap-2"
            onClick={() => {
              setDismissed(true)
              navigate(
                certificationId != null
                  ? `/learner/analytics?certification=${certificationId}&plan=1`
                  : "/learner/analytics?plan=1"
              )
            }}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Create study plan
          </Button>

          {/* A plan is optional and always has been. "Later" has to be a real
              answer, not a way of putting off something mandatory. */}
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default StudyPlanPrompt
