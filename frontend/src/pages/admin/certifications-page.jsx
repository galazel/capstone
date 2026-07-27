import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import CertificationCard from "../../components/certifications/certification-card"
import CertificationFormDrawer from "@/components/certifications/certification-form-drawer"

import { getAllCertifications } from "../../services/certificationService"

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

  const filteredCertifications = useMemo(() => {
    if (chosenIndustry === "all") {
      return items
    }

    return items.filter(
        (certification) => certification.industry === chosenIndustry
    )
  }, [items, chosenIndustry])

  async function handleCertificationSaved() {
    await queryClient.invalidateQueries({
      queryKey: ["admin-certifications"],
    })
  }

  if (isLoading) {
    return <CertificationSkeletonCard size={8} />
  }

  if (isError) {
    return (
        <section className="flex h-full flex-col items-center justify-center gap-4 bg-background">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-foreground">
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
      <section className="flex h-full flex-col gap-5 bg-background">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
            {isFetching && (
                <span className="text-xs text-muted-foreground">
              Updating...
            </span>
            )}

            <Select
                value={chosenIndustry}
                onValueChange={setChosenIndustry}
            >
              <SelectTrigger className="h-9 w-full min-w-0 rounded-lg px-3 text-sm sm:w-[190px]">
                <SelectValue placeholder="Filter by industry" />
              </SelectTrigger>

              <SelectContent
                  position="popper"
                  align="end"
                  sideOffset={6}
                  className="max-h-60 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg p-1"
              >
                <SelectGroup>
                  <SelectItem
                      value="all"
                      className="h-auto min-h-9 whitespace-normal py-2 text-xs leading-4"
                  >
                    All Industries
                  </SelectItem>

                  {industries.map((industry) => (
                      <SelectItem
                          key={industry}
                          value={industry}
                          className="h-auto min-h-9 cursor-pointer whitespace-normal py-2 text-xs leading-4"
                      >
                        {industry}
                      </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
              />
          ))}

          <CertificationFormDrawer
              mode="create"
              open={isCreateDrawerOpen}
              onOpenChange={setIsCreateDrawerOpen}
              onSaved={handleCertificationSaved}
              trigger={
                <button
                    type="button"
                    className="group flex h-[380px] w-full flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-primary/50 bg-primary/[0.03] p-6 text-center transition-all duration-200 hover:border-primary hover:bg-primary/[0.07] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground transition-transform duration-200 group-hover:scale-110">
                    <Plus className="h-6 w-6" strokeWidth={1.8} />
                  </div>

                  <span className="text-base font-medium text-foreground">
                Create Certification
              </span>

                  <span className="mt-1 max-w-[180px] text-sm text-muted-foreground">
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
