import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { getAllCertifications } from "@/services/certificationService.js"
import { submitPublicPartnershipRequest } from "@/services/partnershipService.js"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY_FORM = {
  organizationName: "",
  organizationEmail: "",
  contactPersonName: "",
  contactNumber: "",
  organizationAddress: "",
  businessDescription: "",
}

export default function EnterpriseRequestAccessPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  // certificationId -> requested slots (string while editing)
  const [selected, setSelected] = useState({})
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState(null)

  const certificationsQuery = useQuery({
    queryKey: ["certifications"],
    queryFn: getAllCertifications,
    staleTime: 5 * 60 * 1000,
  })

  const certifications = Array.isArray(certificationsQuery.data)
    ? certificationsQuery.data
    : []

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const toggleCertification = (certificationId) => {
    setSelected((current) => {
      const next = { ...current }
      if (certificationId in next) {
        delete next[certificationId]
      } else {
        next[certificationId] = "10"
      }
      return next
    })
  }

  const setSlots = (certificationId, value) =>
    setSelected((current) => ({ ...current, [certificationId]: value }))

  const selectedItems = useMemo(
    () =>
      Object.entries(selected).map(([certificationId, slots]) => ({
        certificationId: Number(certificationId),
        requestedSlots: Number(slots),
        certification: certifications.find(
          (c) => String(c.certificationId) === String(certificationId)
        ),
      })),
    [selected, certifications]
  )

  const totalSlots = selectedItems.reduce(
    (sum, item) => sum + (Number.isFinite(item.requestedSlots) ? item.requestedSlots : 0),
    0
  )

  const submitMutation = useMutation({
    mutationFn: () =>
      submitPublicPartnershipRequest({
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim(),
        contactPersonName: form.contactPersonName.trim(),
        contactNumber: form.contactNumber.trim(),
        organizationAddress: form.organizationAddress.trim(),
        businessDescription: form.businessDescription.trim(),
        items: selectedItems.map((item) => ({
          certificationId: item.certificationId,
          requestedSlots: item.requestedSlots,
        })),
      }),
    onSuccess: (response) => {
      setConfirmation(response)
      setForm(EMPTY_FORM)
      setSelected({})
      setError("")
      toast.success("Partnership request submitted.")
    },
    onError: (mutationError) => {
      const message =
        mutationError?.response?.data?.message ??
        "Unable to submit your request. Please try again."
      setError(message)
      toast.error(message)
    },
  })

  const validate = () => {
    if (!form.organizationName.trim()) return "Enter your organization name."
    if (!EMAIL_PATTERN.test(form.organizationEmail.trim()))
      return "Enter a valid organization email."
    if (!form.contactPersonName.trim()) return "Enter a contact person name."
    if (!form.contactNumber.trim()) return "Enter a contact number."
    if (!form.organizationAddress.trim()) return "Enter your organization address."
    if (!form.businessDescription.trim())
      return "Add a short description of your organization."
    if (selectedItems.length === 0)
      return "Select at least one certification."
    if (selectedItems.some((item) => !Number.isFinite(item.requestedSlots) || item.requestedSlots < 1))
      return "Each selected certification needs at least 1 learner slot."
    return ""
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError("")
    submitMutation.mutate()
  }

  // --- Confirmation screen ---------------------------------------------------
  if (confirmation) {
    return (
      <div className="min-h-dvh bg-[#F6F9FC] px-5 py-12 text-[#273452]">
        <div className="mx-auto max-w-xl pt-10">
          <Card className="border-[#E0E7EF] shadow-none">
            <CardHeader className="items-center text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <CardTitle className="mt-2 text-2xl">Request submitted</CardTitle>
              <CardDescription>
                Your partnership request has been submitted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm leading-6 text-muted-foreground">
                Our team will review your organization details and requested
                certification access. You will receive an email after the
                request is approved or rejected.
              </p>
              <div className="border-y border-[#E0E7EF] bg-[#F6F9FC] p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Your reference number
                </p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  {confirmation.referenceNumber}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep this to check your request status later.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Back to home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // --- Request form ----------------------------------------------------------
  return (
    <div className="min-h-dvh bg-[#F6F9FC] text-[#273452]">
      <header className="border-b border-[#E0E7EF] bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight">
            <BrandLogo className="size-9" />
            REBYU
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#66758A] hover:text-[#2F7DD3]">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8 sm:py-14">

        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2F7DD3]">Institution partnerships</p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            Request institution access
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tell us about your organization and the certifications your learners
            need. After you submit, our team reviews your request and emails you
            once it is approved or rejected. No account is created yet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-10">
          {/* Organization details */}
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="border-b border-[#E0E7EF] px-0 pb-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="size-5 text-primary" aria-hidden="true" />
                Organization details
              </CardTitle>
              <CardDescription>
                We use these to verify your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 px-0 pt-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  value={form.organizationName}
                  onChange={setField("organizationName")}
                  placeholder="Cebu Institute of Technology"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Organization email</Label>
                <Input
                  id="org-email"
                  type="email"
                  value={form.organizationEmail}
                  onChange={setField("organizationEmail")}
                  placeholder="partnerships@org.edu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-name">Contact person</Label>
                <Input
                  id="contact-name"
                  value={form.contactPersonName}
                  onChange={setField("contactPersonName")}
                  placeholder="Maria Santos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-number">Contact number</Label>
                <Input
                  id="contact-number"
                  value={form.contactNumber}
                  onChange={setField("contactNumber")}
                  placeholder="+63 32 261 7741"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address">Organization address</Label>
                <Input
                  id="org-address"
                  value={form.organizationAddress}
                  onChange={setField("organizationAddress")}
                  placeholder="N. Bacalso Ave, Cebu City"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="org-description">
                  Organization / business description
                </Label>
                <Textarea
                  id="org-description"
                  rows={3}
                  value={form.businessDescription}
                  onChange={setField("businessDescription")}
                  placeholder="Briefly describe your organization and why you want to partner with REBYU."
                />
              </div>
            </CardContent>
          </Card>

          {/* Certification selection */}
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="border-b border-[#E0E7EF] px-0 pb-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap
                  className="size-5 text-primary"
                  aria-hidden="true"
                />
                Requested certification access
              </CardTitle>
              <CardDescription>
                Select the certifications and how many learner slots you need
                for each.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-0 pt-6">
              {certificationsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : certifications.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No certifications are available right now.
                </p>
              ) : (
                certifications.map((certification) => {
                  const id = certification.certificationId
                  const isSelected = id in selected
                  return (
                    <div
                      key={id}
                      className={`flex flex-wrap items-center gap-3 border-b border-[#E0E7EF] px-1 py-4 transition-colors ${isSelected ? "bg-[#E8F3FC]/65" : "bg-transparent"}`}
                    >
                      <label className="flex flex-1 cursor-pointer items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCertification(id)}
                          aria-label={`Select ${certification.title}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {certification.title}
                          </p>
                          {certification.industry ? (
                            <Badge variant="secondary" className="mt-0.5 text-[10px]">
                              {certification.industry}
                            </Badge>
                          ) : null}
                        </div>
                      </label>
                      {isSelected ? (
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`slots-${id}`}
                            className="text-xs text-muted-foreground"
                          >
                            Learner slots
                          </Label>
                          <Input
                            id={`slots-${id}`}
                            type="number"
                            min={1}
                            value={selected[id]}
                            onChange={(event) => setSlots(id, event.target.value)}
                            className="h-9 w-24"
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          {selectedItems.length > 0 ? (
            <Card className="border-[#D8E7F2] bg-[#EAF3FA] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Request summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selectedItems.map((item) => (
                  <div
                    key={item.certificationId}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {item.certification?.title ??
                        `Certification #${item.certificationId}`}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {Number.isFinite(item.requestedSlots)
                        ? item.requestedSlots
                        : 0}{" "}
                      slot(s)
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 font-medium">
                  <span>Total learner slots</span>
                  <span>{totalSlots}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="h-11 w-full sm:ml-auto sm:flex sm:w-auto sm:min-w-64"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Submitting request...
              </>
            ) : (
              "Submit Partnership Request"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
