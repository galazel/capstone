import { useMemo, useState } from "react"
import { Plus } from "@/components/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import CertificationCard from "../../components/certifications/certification-card"
import CertificationFormDrawer from "@/components/certifications/certification-form-drawer"

import { getAllCertifications } from "../../services/certificationService"
import { markGenerationQueued, useActiveGenerations } from "@/hooks/use-active-generations"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { CertificationSkeletonCard } from "../../components/certifications/certification-skeleton-card"
import { industries } from "@/constants/industries.js"

function Certifications() {
  const queryClient = useQueryClient()

  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [chosenIndustry, setChosenIndustry] = useState("all")

  const {
    data: items = [],
    isPending: isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-certifications"],
    queryFn: () => getAllCertifications(),
    staleTime: 1000 * 60 * 5,
  })

  // A generation keeps running after its workspace is closed, so the list asks
  // the run registry which certifications are still being built rather than
  // inferring it from the certification rows — which look complete from the
  // moment the shell is created.
  const { byCertificationId: activeGenerations } = useActiveGenerations()

  const filteredCertifications = useMemo(() => {
    if (chosenIndustry === "all") {
      return items
    }

    return items.filter(
        (certification) => certification.industry === chosenIndustry
    )
  }, [items, chosenIndustry])

  async function handleCertificationSaved(savedCertification) {
    /* Mark it generating BEFORE the list refetches, so the card is already in
       its building state the moment the drawer closes.
       
       Without this there is a gap -- Java has queued the message, but the
       Python consumer has not registered the run and this page polls for runs
       only every ten seconds -- during which a certification that is about to
       build looks like an idle empty draft. That gap is not cosmetic: it is
       what led to a certification being deleted moments after its generation
       was started, on the reasonable assumption that nothing had happened. */
    const certificationId =
        savedCertification?.certificationId ?? savedCertification?.id

    if (certificationId != null) {
      markGenerationQueued(certificationId)
    }

    await queryClient.invalidateQueries({
      queryKey: ["admin-certifications"],
    })
  }

  if (isLoading) {
    return <CertificationSkeletonCard size={8} />
  }

  if (isError) {
    return (
        <section className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="max-w-md text-center">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Unable to load certifications
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {error?.message || "Something went wrong while loading the data."}
            </p>
          </div>

          <Button type="button" onClick={() => refetch()}>
            Try Again
          </Button>
        </section>
    )
  }

  return (
      /* No outer padding here: `.rebyu-page` in index.css already supplies the
         page gutter, and adding a second one indented the grid away from every
         other admin page. */
      <section className="flex flex-col gap-6">
        <header className="rebyu-page-header">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Certifications
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              {filteredCertifications.length}
              {chosenIndustry === "all" ? " total" : ` in ${chosenIndustry}`}
              {isFetching ? " · updating…" : ""}
            </p>
          </div>

          <Select value={chosenIndustry} onValueChange={setChosenIndustry}>
            <SelectTrigger className="h-9 w-full min-w-0 px-3 text-sm sm:w-[190px]">
              <SelectValue placeholder="Filter by industry" />
            </SelectTrigger>

            <SelectContent
                position="popper"
                align="end"
                sideOffset={6}
                className="max-h-60 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto p-1"
            >
              <SelectGroup>
                <SelectItem
                    value="all"
                    className="h-auto min-h-9 py-2 text-xs leading-4 whitespace-normal"
                >
                  All Industries
                </SelectItem>

                {industries.map((industry) => (
                    <SelectItem
                        key={industry}
                        value={industry}
                        className="h-auto min-h-9 cursor-pointer py-2 text-xs leading-4 whitespace-normal"
                    >
                      {industry}
                    </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </header>

        <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredCertifications.map((certification, index) => (
              <CertificationCard
                  key={
                      certification.certificationId ??
                      certification.id ??
                      index
                  }
                  item={certification}
                  certification={certification}
                  index={index}
                  generationRun={activeGenerations.get(
                      String(certification.certificationId ?? certification.id),
                  )}
              />
          ))}

          <CertificationFormDrawer
              open={isCreateDrawerOpen}
              onOpenChange={setIsCreateDrawerOpen}
              onSaved={handleCertificationSaved}
              trigger={
                <button
                    type="button"
                    className="group flex h-[380px] w-full flex-col items-center justify-center gap-1 rounded-[32px] border-2 border-dashed border-primary/50 bg-primary/[0.03] px-6 py-8 text-center transition-all duration-200 hover:border-primary hover:bg-primary/[0.07] focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground transition-transform duration-200 group-hover:scale-110">
                    <Plus className="h-6 w-6" strokeWidth={1.8} />
                  </div>

                  <span className="text-base font-medium text-foreground">
                    Create Certification
                  </span>

                  <span className="max-w-[200px] text-sm leading-6 text-muted-foreground">
                    Add a new certification review for learners.
                  </span>
                </button>
              }
          />
        </div>
      </section>
  )
}

export default Certifications
