import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { ArrowLeft } from "@/components/icons"
import { Button } from "@/components/ui/button"
import QuestionBank from "./question-bank-page.jsx"
import { getAllCertifications } from "@/services/certificationService.js"

/**
 * One certification's question bank, on its own page.
 *
 * <p>It was a tab beside Curriculum and Assessments, which put a library you
 * filter, scan and open rows of inside a container sized for a page you read.
 * The table was capped, the filters competed with the certification header for
 * the top of the screen, and every scroll was two scrolls -- the page's and the
 * tab's. A library is a workspace: it gets the viewport.
 *
 * <p>The bank itself is the same component the tab rendered, in its
 * un-embedded form. This page is a frame around it -- a header and a way back
 * -- so questions authored, edited or deleted here go through exactly the paths
 * they always have.
 */
export default function CertificationQuestionBankPage() {
  const { id: certificationId } = useParams()

  const { data: certifications = [] } = useQuery({
    queryKey: ["admin-certifications", "question-bank-page"],
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
            Question bank
          </p>
          <p className="truncate text-sm font-bold text-foreground">
            {certification?.title ?? "This certification"}
          </p>
        </div>

      </header>

      {/* The bank fills what is left. `min-h-0` is what lets it: without it a
          flex child refuses to shrink below its content, and the table's own
          scroll container would never engage. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <QuestionBank certificationId={Number(certificationId)} />
      </div>
    </div>
  )
}
