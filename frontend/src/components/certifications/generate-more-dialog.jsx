import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DocumentUploadStep } from "@/components/certifications/document-upload-step.jsx"
import { QuestionTypeChoice } from "@/components/certifications/question-type-choice.jsx"
import { appendToCertificationWithAi } from "@/services/certificationService.js"

/**
 * Adds to a certification that already exists.
 *
 * <p>Deliberately not the same control as "generate": that path clears the
 * curriculum first, which is right for a rebuild and destructive for an
 * addition. An admin who uploaded four of five handbooks, or whose syllabus
 * grew a domain, wants the fifth added -- not the four they already paid to
 * author thrown away along with every question and assessment hanging off
 * them.
 *
 * <p>The dialog says that plainly, because "generate" appearing twice on one
 * page with opposite consequences is exactly the kind of thing an admin only
 * discovers afterwards.
 */
export default function GenerateMoreDialog({ open, onOpenChange, certification }) {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState([])
  const [instructions, setInstructions] = useState("")
  const [questionTypes, setQuestionTypes] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const certificationId = certification?.certificationId ?? certification?.id

  function reset() {
    setFiles([])
    setInstructions("")
    setQuestionTypes([])
    setIsSubmitting(false)
  }

  async function handleSubmit() {
    if (files.length === 0) {
      toast.error("Add at least one document to generate from.")
      return
    }

    setIsSubmitting(true)
    try {
      await appendToCertificationWithAi(certificationId, files, {
        additionalInstructions: instructions,
        questionTypes,
      })
      // The certification is now generating; the page reads that flag from the
      // certification list, so it has to be refetched for the banner to appear.
      await queryClient.invalidateQueries({ queryKey: ["admin-certifications"] })
      toast.success(
        "Generation queued. The new material is added to this certification as it is written."
      )
      onOpenChange(false)
      reset()
    } catch (error) {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          "Could not start the generation. Please try again."
      )
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add to this certification</DialogTitle>
          <DialogDescription>
            Upload the material for what is missing â€” another domain, a new
            module, further lessons. The planner is given the curriculum that
            already exists and asked only for what these documents add.
          </DialogDescription>
        </DialogHeader>

        {/* Stated because the neighbouring "generate" path deletes the
            curriculum first, and an admin has no way to tell them apart from
            the button alone. */}
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
          Nothing existing is removed. Your current majors, lessons, questions
          and assessments stay exactly as they are, and lessons that already
          exist are not written again.
        </div>

        <div className="space-y-4">
          {/* Emits raw File objects, not wrappers -- it maps `item.file`
              before calling back. */}
          <DocumentUploadStep onFilesChange={setFiles} disabled={isSubmitting} />

          <QuestionTypeChoice
              value={questionTypes}
              onChange={setQuestionTypes}
              disabled={isSubmitting}
          />

          <div className="space-y-2">
            <Label htmlFor="append-instructions">
              Anything specific to add? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="append-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="e.g. Add the Business and Ethics domain only; the other four are already covered."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || files.length === 0}>
            {isSubmitting ? "Queueing..." : "Generate and add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
