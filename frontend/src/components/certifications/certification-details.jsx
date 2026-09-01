import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { industries } from "@/constants/industries.js"

/* From the shared rulebook, not redeclared here. This file's own copy had
   drifted to a 300-character description while `validateCertificationDetails`
   -- the check that actually decides whether the form submits, and the one the
   certification page edits against -- allowed 2000. The field stopped you
   typing at 300 for a limit nothing enforced. */
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  MIN_TITLE_LENGTH,
} from "@/utils/certification-edit"

/**
 * `disabled` locks every control at once.
 *
 * The drawer starts a generation and keeps the form on screen while the job is
 * queued and handed off. Editing the name or the description during that
 * window changes nothing about the run -- the payload was sent when the button
 * was pressed -- so the field is a control that silently does not work, and
 * the admin only finds out when the finished certification carries the text
 * they thought they had replaced.
 */
function CertificationDetails({ value, onChange, errors = {}, disabled = false }) {
  function updateField(fieldName, fieldValue) {
    onChange({
      ...value,
      [fieldName]: fieldValue,
    })
  }

  return (
      <FieldSet className="w-full">
        <FieldGroup className="gap-5">
          {}
          <Field>
            <FieldLabel htmlFor="certification-title">
              Certification Name
            </FieldLabel>

            <Input
                id="certification-title"
                type="text"
                disabled={disabled}
                value={value.title ?? ""}
                minLength={MIN_TITLE_LENGTH}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) => {
                  updateField("title", event.target.value)
                }}
                placeholder="Example: IT Passport Certification"
                aria-invalid={Boolean(errors.title)}
                aria-describedby={
                  errors.title
                      ? "certification-title-error"
                      : "certification-title-description"
                }
            />

            <FieldDescription id="certification-title-description">
              Use at least {MIN_TITLE_LENGTH} characters and no more than{" "}
              {MAX_TITLE_LENGTH} characters.
            </FieldDescription>

            {errors.title && (
                <FieldError id="certification-title-error">
                  {errors.title}
                </FieldError>
            )}
          </Field>

          <FieldGroup className="grid grid-cols-1 gap-5">
            {}
            <Field>
              <FieldLabel htmlFor="certification-industry">
                Industry
              </FieldLabel>

              <Select
                  disabled={disabled}
                  value={value.industry ?? ""}
                  onValueChange={(selectedIndustry) => {
                    updateField("industry", selectedIndustry)
                  }}
              >
                <SelectTrigger
                    id="certification-industry"
                    className="w-full"
                    aria-invalid={Boolean(errors.industry)}
                    aria-describedby={
                      errors.industry
                          ? "certification-industry-error"
                          : undefined
                    }
                >
                  <SelectValue placeholder="Select an industry" />
                </SelectTrigger>

                <SelectContent>
                  {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {errors.industry && (
                  <FieldError id="certification-industry-error">
                    {errors.industry}
                  </FieldError>
              )}
            </Field>
          </FieldGroup>

          <Field>
            <FieldLabel htmlFor="certification-description">
              Description
            </FieldLabel>

            <Textarea

                disabled={disabled}
                id="certification-description"
                value={value.description ?? ""}
                minLength={MIN_DESCRIPTION_LENGTH}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onChange={(event) => {
                  updateField("description", event.target.value)
                }}
                placeholder="Write a short description about this certification review."
                className="min-h-28 resize-y"
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description
                      ? "certification-description-error"
                      : "certification-description-help"
                }
            />

            <div className="flex items-center justify-between gap-3">
              <FieldDescription id="certification-description-help">
                Explain what learners will study in this review. Minimum:{" "}
                {MIN_DESCRIPTION_LENGTH} characters.
              </FieldDescription>

              <span className="shrink-0 text-xs text-muted-foreground">
              {(value.description ?? "").length}/{MAX_DESCRIPTION_LENGTH}
            </span>
            </div>

            {errors.description && (
                <FieldError id="certification-description-error">
                  {errors.description}
                </FieldError>
            )}
          </Field>

          {/* No cover field at all. The cover is the certification's name on
              blue, drawn on the cards — there is nothing to upload and nothing
              to decide, so the form does not mention it. */}
        </FieldGroup>
      </FieldSet>
  )
}

export default CertificationDetails