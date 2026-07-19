import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAllEnterprises } from "@/services/adminEnterpriseService"

const PAGE_SIZE = 8
const ALL_FILTER_VALUE = "all"

// Replace this with data from your organization service.
// The component also accepts an `organizations` prop.
const DEMO_ORGANIZATIONS = [
  {
    organizationId: 1,
    organizationName: "Cebu Institute of Technology",
    contactPerson: "Maria Santos",
    contactEmail: "maria.santos@example.com",
    industry: "Education",
    learnerCount: 428,
    certificationCount: 4,
    status: "active",
    createdAt: "2026-06-12",
  },
  {
    organizationId: 2,
    organizationName: "TechBridge Training Center",
    contactPerson: "Daniel Reyes",
    contactEmail: "daniel.reyes@example.com",
    industry: "Training Center",
    learnerCount: 215,
    certificationCount: 3,
    status: "active",
    createdAt: "2026-06-07",
  },
  {
    organizationId: 3,
    organizationName: "Northstar Review Academy",
    contactPerson: "Angela Cruz",
    contactEmail: "angela.cruz@example.com",
    industry: "Review Center",
    learnerCount: 126,
    certificationCount: 2,
    status: "pending",
    createdAt: "2026-05-28",
  },
  {
    organizationId: 4,
    organizationName: "Innovate Cebu Solutions",
    contactPerson: "Paolo Lim",
    contactEmail: "paolo.lim@example.com",
    industry: "Information Technology",
    learnerCount: 89,
    certificationCount: 2,
    status: "active",
    createdAt: "2026-05-21",
  },
  {
    organizationId: 5,
    organizationName: "Global Skills Development Hub",
    contactPerson: "Karen Dela Peña",
    contactEmail: "karen.delapena@example.com",
    industry: "Professional Training",
    learnerCount: 304,
    certificationCount: 5,
    status: "active",
    createdAt: "2026-05-14",
  },
  {
    organizationId: 6,
    organizationName: "Metro Learning Partners",
    contactPerson: "Joshua Tan",
    contactEmail: "joshua.tan@example.com",
    industry: "Education",
    learnerCount: 72,
    certificationCount: 1,
    status: "suspended",
    createdAt: "2026-04-30",
  },
  {
    organizationId: 7,
    organizationName: "FutureReady Philippines",
    contactPerson: "Nicole Ramos",
    contactEmail: "nicole.ramos@example.com",
    industry: "Training Center",
    learnerCount: 191,
    certificationCount: 3,
    status: "pending",
    createdAt: "2026-04-18",
  },
  {
    organizationId: 8,
    organizationName: "Digital Career Academy",
    contactPerson: "Mark Villanueva",
    contactEmail: "mark.villanueva@example.com",
    industry: "Review Center",
    learnerCount: 154,
    certificationCount: 2,
    status: "active",
    createdAt: "2026-04-03",
  },
  {
    organizationId: 9,
    organizationName: "Central Visayas Tech Council",
    contactPerson: "Leah Mendoza",
    contactEmail: "leah.mendoza@example.com",
    industry: "Government",
    learnerCount: 511,
    certificationCount: 6,
    status: "active",
    createdAt: "2026-03-25",
  },
]

const statusStyles = {
  active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  suspended:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
}

function getOrganizationId(organization, index) {
  return (
      organization.enterpriseId ??
      organization.organizationId ??
      organization.id ??
      `organization-${index}`
  )
}

function getOrganizationName(organization) {
  return (
      organization.enterpriseName ??
      organization.organizationName ??
      organization.name ??
      organization.title ??
      "Unnamed organization"
  )
}

function getInitials(name) {
  return String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
}

function formatDate(value) {
  if (!value) return "—"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function OrganizationStatusBadge({ status }) {
  const normalizedStatus = String(status ?? "pending").toLowerCase()
  const label =
      normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)

  return (
      <Badge
          variant="outline"
          className={
              statusStyles[normalizedStatus] ??
              "border-slate-200 bg-slate-50 text-slate-700"
          }
      >
        {label}
      </Badge>
  )
}

export default function Organizations({
                                        onCreate,
                                        onView,
                                        onEdit,
                                        onDelete,
                                      }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE)
  const [industryFilter, setIndustryFilter] = useState(ALL_FILTER_VALUE)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: fetchedOrganizations = [], isLoading } = useQuery({
    queryKey: ["admin-enterprises"],
    queryFn: () => getAllEnterprises(),
    staleTime: 5 * 60 * 1000,
  })

  const list = Array.isArray(fetchedOrganizations) ? fetchedOrganizations : []

  const industries = useMemo(() => {
    return [...new Set(
        list
            .map((organization) => organization.industry)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b))
  }, [list])

  const filteredOrganizations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return list.filter((organization) => {
      const name = getOrganizationName(organization).toLowerCase()
      const contactPerson = String(
          organization.primaryContactName ??
          organization.contactPerson ??
          organization.contactName ??
          ""
      ).toLowerCase()
      const email = String(
          organization.primaryContactEmail ??
          organization.contactEmail ??
          organization.email ??
          ""
      ).toLowerCase()
      const industry = String(organization.industry ?? "").toLowerCase()
      const status = String(organization.status ?? "pending").toLowerCase()

      const matchesSearch =
          !normalizedSearch ||
          name.includes(normalizedSearch) ||
          contactPerson.includes(normalizedSearch) ||
          email.includes(normalizedSearch)

      const matchesStatus =
          statusFilter === ALL_FILTER_VALUE || status === statusFilter

      const matchesIndustry =
          industryFilter === ALL_FILTER_VALUE ||
          industry === industryFilter.toLowerCase()

      return matchesSearch && matchesStatus && matchesIndustry
    })
  }, [industryFilter, list, searchQuery, statusFilter])

  const totalPages = Math.max(
      1,
      Math.ceil(filteredOrganizations.length / PAGE_SIZE)
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, industryFilter])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedOrganizations = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE

    return filteredOrganizations.slice(
        startIndex,
        startIndex + PAGE_SIZE
    )
  }, [currentPage, filteredOrganizations])

  const activeCount = useMemo(
      () =>
          list.filter(
              (organization) =>
                  String(organization.status ?? "").toLowerCase() === "active"
          ).length,
      [list]
  )

  const totalLearners = useMemo(
      () =>
          list.reduce(
              (total, organization) =>
                  total +
                  Number(
                      organization.learnerCount ??
                      organization.totalLearners ??
                      organization.learnersCount ??
                      0
                  ),
              0
          ),
      [list]
  )

  const visibleStart =
      filteredOrganizations.length === 0
          ? 0
          : (currentPage - 1) * PAGE_SIZE + 1

  const visibleEnd = Math.min(
      currentPage * PAGE_SIZE,
      filteredOrganizations.length
  )

  return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 justify-end pb-4">
            <Button type="button" onClick={onCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Organization
            </Button>
        </div>

        <div className="grid shrink-0 gap-3 border-b border-border bg-background py-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Total organizations
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <p className="text-xl font-semibold tabular-nums">{list.length}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Active organizations
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="text-xl font-semibold tabular-nums">{activeCount}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Enterprise learners
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xl font-semibold tabular-nums">
                {totalLearners.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search organization, contact, or email..."
                className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All industries" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All industries</SelectItem>

                {industries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto py-4">
          <div className="overflow-hidden rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="min-w-64">Organization</TableHead>
                  <TableHead className="min-w-56">Primary contact</TableHead>
                  <TableHead className="min-w-40">Industry</TableHead>
                  <TableHead className="w-28 text-center">Learners</TableHead>
                  <TableHead className="w-32 text-center">
                    Certifications
                  </TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="min-w-32">Date added</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`loading-${index}`}>
                          <TableCell colSpan={8} className="h-16">
                            <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          </TableCell>
                        </TableRow>
                    ))
                ) : paginatedOrganizations.length > 0 ? (
                    paginatedOrganizations.map((organization, index) => {
                      const organizationName = getOrganizationName(organization)
                      const learnerCount = Number(
                          organization.learnerCount ??
                          organization.totalLearners ??
                          organization.learnersCount ??
                          0
                      )
                      const certificationCount = Number(
                          organization.certificationCount ??
                          organization.totalCertifications ??
                          organization.certificationsCount ??
                          0
                      )

                      return (
                          <TableRow
                              key={getOrganizationId(organization, index)}
                              className="group"
                          >
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-primary/5 text-xs font-bold text-primary">
                                  {getInitials(organizationName)}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {organizationName}
                                  </p>

                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    ID: {getOrganizationId(organization, index)}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {organization.primaryContactName ??
                                      organization.contactPerson ??
                                      organization.contactName ??
                                      "Not assigned"}
                                </p>

                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {organization.primaryContactEmail ??
                                      organization.contactEmail ??
                                      organization.email ??
                                      "No email provided"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell className="text-sm text-muted-foreground">
                              {organization.industry ?? "Not specified"}
                            </TableCell>

                            <TableCell className="text-center font-medium tabular-nums">
                              {learnerCount.toLocaleString()}
                            </TableCell>

                            <TableCell className="text-center font-medium tabular-nums">
                              {certificationCount}
                            </TableCell>

                            <TableCell>
                              <OrganizationStatusBadge
                                  status={organization.status}
                              />
                            </TableCell>

                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(
                                  organization.joinedAt ??
                                  organization.createdAt ??
                                  organization.dateCreated ??
                                  organization.createdDate
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      aria-label={`Actions for ${organizationName}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                      onSelect={() => onView?.(organization)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View details
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                      onSelect={() => onEdit?.(organization)}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem
                                      onSelect={() => onDelete?.(organization)}
                                      className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                      )
                    })
                ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <p className="mt-4 text-sm font-semibold">
                            No organizations found
                          </p>

                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Try changing the search or filter, or add a new
                            organization.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-border bg-background py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">{visibleStart}</span>
            {"–"}
            <span className="font-medium text-foreground">{visibleEnd}</span>
            {" of "}
            <span className="font-medium text-foreground">
            {filteredOrganizations.length}
          </span>{" "}
            organizations
          </p>

          <div className="flex items-center gap-1">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-24 px-2 text-center text-sm tabular-nums text-muted-foreground">
            Page{" "}
              <span className="font-medium text-foreground">{currentPage}</span>
              {" of "}
              <span className="font-medium text-foreground">{totalPages}</span>
          </span>

            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage === totalPages}
                aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </section>
  )
}
