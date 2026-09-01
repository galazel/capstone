import { useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { ArrowLeft } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import AssessmentsTab from "@/components/assessments/admin/assessments-tab.jsx"
import { getAllCertifications } from "@/services/certificationService.js"

/**
 * One certification's assessments, on its own page.
 *
 * <p>They sat at the bottom of the certification page, below the whole
 * curriculum -- a table you search, filter and open rows of, reachable only by
 * scrolling past everything else on a page about something else. The question
 * bank was moved out for the same reason and this is the same frame: a header
 * that says which certification you are in, a way back, and the workspace.
 *
 * <p>The publishing checklist stays behind on the certification page, because
 * what it is really about is whether the certification can go live. Its
 * "Create ..." buttons now navigate here and hand the request over in router
 * state, so the flow from a missing requirement to the dialog that fills it is
 * the one it always was, one page further along.
 */
export default function CertificationAssessmentsPage() {
  const { id: certificationId } = useParams()
  const location = useLocation()

  /* The same key the certification page reads under, so arriving from it costs
     nothing -- the list is already in cache and this page draws immediately.
     Entered by URL, it is one fetch, the same one that page would have made. */
  const { data: certifications = [], isLoading } = useQuery({
    queryKey: ["admin-certifications", "certification-page"],
    queryFn: () => getAllCertifications(),
    staleTime: 5 * 60 * 1000,
  })

  const certification = useMemo(
    () =>
      certifications.find(
        (item) => String(item.certificationId ?? item.id) === String(certificationId),
      ),
    [certifications, certificationId],
  )

  /* Read once, on mount. The checklist's button navigates here with the
     assessment it wants created; holding it in state rather than reading
     location on every render means going back and forward through history
     cannot silently reopen a dialog the admin already dealt with. */
  const [createRequest, setCreateRequest] = useState(
    () => location.state?.createAssessment ?? null,
  )

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-muted/20">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2.5">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to certification">
          <Link to={`/admin/certification/${certificationId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Assessments
          </p>
          {/* A skeleton rather than a placeholder sentence while the list is in
              flight -- a real name that is then replaced by a different real
              name reads as an answer that turned out to be wrong. */}
          {isLoading ? (
            <Skeleton className="mt-0.5 h-4 w-48 rounded-rb-control" />
          ) : (
            <p className="truncate text-sm font-bold text-foreground">
              {certification?.title ?? "This certification"}
            </p>
          )}
        </div>
      </header>

      {/* Bounded, not scrolling. The workspace inside is the only thing that
          scrolls, and it can only size itself against a parent whose height is
          already decided -- `min-h-0` is what stops this flex child from
          growing to fit its content and pushing the page taller instead.

          No width cap and no auto margins: on its own page the window is the
          container. A max-width here just puts back the inset that moving off
          the certification page was meant to remove -- the same note the
          question bank carries, for the same reason. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6">
        <div className="flex min-h-0 w-full flex-1 flex-col">
          {isLoading && !certification ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : certification ? (
            <AssessmentsTab
              certification={certification}
              createRequest={createRequest}
              onCreateRequestHandled={() => setCreateRequest(null)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-medium">Certification not found</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                It may have been deleted, or the link may be out of date.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/admin">Back to certifications</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
