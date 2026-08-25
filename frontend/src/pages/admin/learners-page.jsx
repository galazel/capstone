import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Award,
  Eye,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Progress,
} from "@/components/ui/progress"
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
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PlainHead,
  SortableHead,
  TableCard,
  TablePagination,
  TableToolbar,
  useTableSort,
} from "@/components/commons/data-table.jsx"
import { getAllLearners } from "@/services/adminLearnerService"

const ALL_FILTER_VALUE = "all"

// Replace this with data from your learner service.
// The component also accepts a `learners` prop.
const DEMO_LEARNERS = [
  {
    learnerId: 1,
    firstName: "Alyssa",
    lastName: "Santos",
    email: "alyssa.santos@example.com",
    organizationName: "Cebu Institute of Technology",
    learnerType: "institution",
    certificationCount: 3,
    progressPercentage: 78,
    status: "active",
    joinedAt: "2026-06-18",
  },
  {
    learnerId: 2,
    firstName: "John Mark",
    lastName: "Reyes",
    email: "john.reyes@example.com",
    organizationName: null,
    learnerType: "individual",
    certificationCount: 2,
    progressPercentage: 62,
    status: "active",
    joinedAt: "2026-06-15",
  },
  {
    learnerId: 3,
    firstName: "Patricia",
    lastName: "Cruz",
    email: "patricia.cruz@example.com",
    organizationName: "TechBridge Training Center",
    learnerType: "institution",
    certificationCount: 1,
    progressPercentage: 35,
    status: "active",
    joinedAt: "2026-06-11",
  },
  {
    learnerId: 4,
    firstName: "Miguel",
    lastName: "Tan",
    email: "miguel.tan@example.com",
    organizationName: null,
    learnerType: "individual",
    certificationCount: 4,
    progressPercentage: 91,
    status: "active",
    joinedAt: "2026-06-03",
  },
  {
    learnerId: 5,
    firstName: "Nicole",
    lastName: "Ramos",
    email: "nicole.ramos@example.com",
    organizationName: "Northstar Review Academy",
    learnerType: "institution",
    certificationCount: 2,
    progressPercentage: 48,
    status: "pending",
    joinedAt: "2026-05-28",
  },
  {
    learnerId: 6,
    firstName: "Joshua",
    lastName: "Lim",
    email: "joshua.lim@example.com",
    organizationName: "Digital Career Academy",
    learnerType: "institution",
    certificationCount: 2,
    progressPercentage: 19,
    status: "inactive",
    joinedAt: "2026-05-20",
  },
  {
    learnerId: 7,
    firstName: "Camille",
    lastName: "Mendoza",
    email: "camille.mendoza@example.com",
    organizationName: null,
    learnerType: "individual",
    certificationCount: 1,
    progressPercentage: 54,
    status: "active",
    joinedAt: "2026-05-12",
  },
  {
    learnerId: 8,
    firstName: "Paolo",
    lastName: "Villanueva",
    email: "paolo.villanueva@example.com",
    organizationName: "FutureReady Philippines",
    learnerType: "institution",
    certificationCount: 3,
    progressPercentage: 83,
    status: "active",
    joinedAt: "2026-05-02",
  },
  {
    learnerId: 9,
    firstName: "Angela",
    lastName: "Dela Cruz",
    email: "angela.delacruz@example.com",
    organizationName: null,
    learnerType: "individual",
    certificationCount: 2,
    progressPercentage: 41,
    status: "pending",
    joinedAt: "2026-04-25",
  },
]

const statusStyles = {
  active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  inactive:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  suspended:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
}

const learnerTypeStyles = {
  institution:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  individual:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
}

function getLearnerId(learner, index) {
  return learner.learnerId ?? learner.id ?? `learner-${index}`
}

function getLearnerName(learner) {
  const fullName = [
    learner.firstName,
    learner.middleName,
    learner.lastName,
  ]
      .filter(Boolean)
      .join(" ")
      .trim()

  return (
      learner.fullName ??
      learner.name ??
      fullName ??
      "Unnamed learner"
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

function LearnerStatusBadge({ status }) {
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

function LearnerTypeBadge({ type }) {
  const normalizedType = String(type ?? "individual").toLowerCase()

  return (
      <Badge
          variant="outline"
          className={
              learnerTypeStyles[normalizedType] ??
              "border-slate-200 bg-slate-50 text-slate-700"
          }
      >
        {normalizedType === "institution" ? "Institution" : "Individual"}
      </Badge>
  )
}

export default function Learners({
                                   onCreate,
                                   onView,
                                   onEdit,
                                   onDelete,
                                 }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE)
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER_VALUE)
  const [organizationFilter, setOrganizationFilter] =
      useState(ALL_FILTER_VALUE)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { sort, toggle, sortRows } = useTableSort()

  const { data: fetchedLearners = [], isLoading } = useQuery({
    queryKey: ["admin-learners"],
    queryFn: () => getAllLearners(),
    staleTime: 5 * 60 * 1000,
  })

  const list = Array.isArray(fetchedLearners) ? fetchedLearners : []

  const organizations = useMemo(() => {
    return [
      ...new Set(
          list
              .map(
                  (learner) =>
                      learner.organizationName ??
                      learner.organization?.name ??
                      learner.organization?.organizationName
              )
              .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b))
  }, [list])

  const filteredLearners = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return list.filter((learner) => {
      const learnerName = getLearnerName(learner).toLowerCase()
      const email = String(learner.email ?? "").toLowerCase()
      const organizationName = String(
          learner.organizationName ??
          learner.organization?.name ??
          learner.organization?.organizationName ??
          ""
      )
      const organizationNameLower = organizationName.toLowerCase()
      const status = String(learner.status ?? "pending").toLowerCase()
      const type = String(
          learner.learnerType ??
          learner.type ??
          (organizationName ? "institution" : "individual")
      ).toLowerCase()

      const matchesSearch =
          !normalizedSearch ||
          learnerName.includes(normalizedSearch) ||
          email.includes(normalizedSearch) ||
          organizationNameLower.includes(normalizedSearch)

      const matchesStatus =
          statusFilter === ALL_FILTER_VALUE || status === statusFilter

      const matchesType =
          typeFilter === ALL_FILTER_VALUE || type === typeFilter

      const matchesOrganization =
          organizationFilter === ALL_FILTER_VALUE ||
          organizationName === organizationFilter

      return (
          matchesSearch &&
          matchesStatus &&
          matchesType &&
          matchesOrganization
      )
    })
  }, [
    list,
    organizationFilter,
    searchQuery,
    statusFilter,
    typeFilter,
  ])

  /* Sorting runs on the filtered set, so a sort never pulls in a row the
     filters excluded. Accessors read the same fallbacks the cells render. */
  const sortedLearners = useMemo(
      () =>
          sortRows(filteredLearners, {
            learner: (learner) => getLearnerName(learner),
            organization: (learner) =>
                learner.organizationName ??
                learner.organization?.name ??
                learner.organization?.organizationName ??
                null,
            type: (learner) =>
                learner.learnerType ?? learner.type ?? "individual",
            certifications: (learner) =>
                Number(
                    learner.certificationCount ??
                    learner.totalCertifications ??
                    learner.certificationsCount ??
                    0
                ),
            progress: (learner) =>
                Number(
                    learner.progressPercentage ??
                    learner.progress ??
                    learner.overallProgress ??
                    0
                ),
            status: (learner) => learner.status ?? "pending",
            joined: (learner) => {
              const raw =
                  learner.joinedAt ?? learner.createdAt ?? learner.dateCreated
              const time = raw ? new Date(raw).getTime() : Number.NaN
              return Number.isNaN(time) ? null : time
            },
          }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [filteredLearners, sort]
  )

  const totalPages = Math.max(
      1,
      Math.ceil(sortedLearners.length / pageSize)
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, typeFilter, organizationFilter, pageSize])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedLearners = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize

    return sortedLearners.slice(
        startIndex,
        startIndex + pageSize
    )
  }, [currentPage, pageSize, sortedLearners])

  const activeCount = useMemo(
      () =>
          list.filter(
              (learner) =>
                  String(learner.status ?? "").toLowerCase() === "active"
          ).length,
      [list]
  )

  const institutionCount = useMemo(
      () =>
          list.filter((learner) => {
            const organizationName =
                learner.organizationName ??
                learner.organization?.name ??
                learner.organization?.organizationName

            const type = String(
                learner.learnerType ??
                learner.type ??
                (organizationName ? "institution" : "individual")
            ).toLowerCase()

            return type === "institution"
          }).length,
      [list]
  )

  const individualCount = list.length - institutionCount

  const visibleStart =
      sortedLearners.length === 0
          ? 0
          : (currentPage - 1) * pageSize + 1

  const visibleEnd = Math.min(
      currentPage * pageSize,
      sortedLearners.length
  )

  return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 justify-end pb-4">
            <Button type="button" onClick={onCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Learner
            </Button>
        </div>

        <div className="grid shrink-0 gap-3 border-b border-border bg-background py-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Total learners
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xl font-semibold tabular-nums">
                {list.length}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Active learners
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="text-xl font-semibold tabular-nums">
                {activeCount}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Institution learners
            </p>
            <div className="mt-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <p className="text-xl font-semibold tabular-nums">
                {institutionCount}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Individual learners
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <p className="text-xl font-semibold tabular-nums">
                {individualCount}
              </p>
            </div>
          </div>
        </div>

        {/* One card holds the toolbar, the rows, and the pager, so the table
            reads as a single object rather than three stacked panels. */}
        <div className="min-h-0 flex-1 overflow-auto py-4">
          <TableCard>
            <TableToolbar
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                search={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search learner, email, or organization"
            >
              <Select
                  value={organizationFilter}
                  onValueChange={setOrganizationFilter}
              >
                <SelectTrigger className="h-9 w-full sm:w-52">
                  <SelectValue placeholder="All organizations" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>
                    All organizations
                  </SelectItem>

                  {organizations.map((organization) => (
                      <SelectItem
                          key={organization}
                          value={organization}
                      >
                        {organization}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36">
                  <SelectValue placeholder="All learner types" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All types</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="institution">Institution</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </TableToolbar>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHead
                      column="learner"
                      label="Learner"
                      sort={sort}
                      onSort={toggle}
                      className="min-w-64"
                  />
                  <SortableHead
                      column="organization"
                      label="Organization"
                      sort={sort}
                      onSort={toggle}
                      className="min-w-52"
                  />
                  <SortableHead
                      column="type"
                      label="Type"
                      sort={sort}
                      onSort={toggle}
                      className="w-32"
                  />
                  <SortableHead
                      column="certifications"
                      label="Certifications"
                      sort={sort}
                      onSort={toggle}
                      className="w-32 text-center"
                  />
                  <SortableHead
                      column="progress"
                      label="Progress"
                      sort={sort}
                      onSort={toggle}
                      className="min-w-52"
                  />
                  <SortableHead
                      column="status"
                      label="Status"
                      sort={sort}
                      onSort={toggle}
                      className="w-28"
                  />
                  <SortableHead
                      column="joined"
                      label="Date joined"
                      sort={sort}
                      onSort={toggle}
                      className="min-w-32"
                  />
                  <PlainHead label="Actions" align="right" className="w-16" />
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
                ) : paginatedLearners.length > 0 ? (
                    paginatedLearners.map((learner, index) => {
                      const learnerName = getLearnerName(learner)
                      const organizationName =
                          learner.organizationName ??
                          learner.organization?.name ??
                          learner.organization?.organizationName

                      const learnerType = String(
                          learner.learnerType ??
                          learner.type ??
                          (organizationName ? "institution" : "individual")
                      ).toLowerCase()

                      const certificationCount = Number(
                          learner.certificationCount ??
                          learner.totalCertifications ??
                          learner.certificationsCount ??
                          0
                      )

                      const progressPercentage = Math.min(
                          100,
                          Math.max(
                              0,
                              Number(
                                  learner.progressPercentage ??
                                  learner.progress ??
                                  learner.overallProgress ??
                                  0
                              )
                          )
                      )

                      return (
                          <TableRow
                              key={getLearnerId(learner, index)}
                              className="group"
                          >
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-primary/5 text-xs font-bold text-primary">
                                  {getInitials(learnerName)}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {learnerName}
                                  </p>

                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {learner.email ?? "No email provided"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              {organizationName ? (
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {organizationName}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      Organization learner
                                    </p>
                                  </div>
                              ) : (
                                  <span className="text-sm text-muted-foreground">
                            Not affiliated
                          </span>
                              )}
                            </TableCell>

                            <TableCell>
                              <LearnerTypeBadge type={learnerType} />
                            </TableCell>

                            <TableCell className="text-center font-medium tabular-nums">
                              {certificationCount}
                            </TableCell>

                            <TableCell>
                              <div className="flex min-w-40 items-center gap-3">
                                <Progress
                                    value={progressPercentage}
                                    className="h-2 flex-1"
                                />
                                <span className="w-10 text-right text-xs font-medium tabular-nums text-muted-foreground">
                            {progressPercentage}%
                          </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <LearnerStatusBadge status={learner.status} />
                            </TableCell>

                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(
                                  learner.joinedAt ??
                                  learner.createdAt ??
                                  learner.dateCreated
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
                                      aria-label={`Actions for ${learnerName}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                      onSelect={() => onView?.(learner)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View profile
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                      onSelect={() => onEdit?.(learner)}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem
                                      onSelect={() => onDelete?.(learner)}
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
                            <Users className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <p className="mt-4 text-sm font-semibold">
                            No learners found
                          </p>

                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Try changing the search or filters, or add a new learner.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>

            <TablePagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                rangeStart={visibleStart}
                rangeEnd={visibleEnd}
                total={sortedLearners.length}
                unit="learners"
            />
          </TableCard>
        </div>
      </section>
  )
}
