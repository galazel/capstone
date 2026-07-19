import { useMemo, useState } from "react"
import { Link, useOutletContext, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileQuestionIcon,
  Layers3Icon,
  MailIcon,
  UsersRoundIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
  formatDate,
} from "@/components/enterprise/enterprise-ui.jsx"
import { useEnterpriseData } from "@/hooks/use-enterprise-data.js"
import { getAllCertifications } from "@/services/certificationService.js"
import { getEnterpriseGroups } from "@/services/enterpriseService.js"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function MiddleCategoryRow({ middleCategory, orgCertId }) {
  const [isOpen, setIsOpen] = useState(false)
  const lessons = middleCategory.lessons ?? []

  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{middleCategory.title}</p>
          <p className="text-xs text-muted-foreground">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
          </p>
        </div>
        {isOpen ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {isOpen ? (
        <div className="space-y-1.5 border-t bg-muted/20 p-3">
          {lessons.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              No lessons in this module yet.
            </p>
          ) : (
            lessons.map((lesson, index) => (
              <div
                key={lesson.lessonId ?? index}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
              >
                <span className="truncate text-sm">{lesson.name}</span>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to={`/enterprise/question-bank?certificationId=${
                      middleCategory.__certificationId
                    }&lessonId=${lesson.lessonId}&add=1`}
                  >
                    <FileQuestionIcon className="size-4" aria-hidden="true" />
                    Add Question
                  </Link>
                </Button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function EnterpriseCertificationDetailPage() {
  const { orgCertId } = useParams()
  const numericOrgCertId = Number(orgCertId)
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const enterpriseId = enterprise?.enterpriseId
  const data = useEnterpriseData(enterpriseId)

  const certificationsQuery = useQuery({
    queryKey: ["certifications-full"],
    queryFn: getAllCertifications,
    staleTime: 5 * 60 * 1000,
  })

  const orgCert = data.orgCertById.get(numericOrgCertId)

  const groupsQuery = useQuery({
    queryKey: ["enterprise-groups", enterpriseId],
    queryFn: () => getEnterpriseGroups({ enterpriseId }),
    enabled: enterpriseId != null,
  })

  const groups = asArray(groupsQuery.data).filter(
    (group) => group.orgCertId === numericOrgCertId && group.status === "active"
  )

  const groupInvitations = useMemo(() => {
    const groupIds = new Set(groups.map((g) => g.enterpriseGroupId))
    return asArray(data.invitations).filter((inv) => groupIds.has(inv.enterpriseGroupId))
  }, [data.invitations, groups])

  const certification = useMemo(() => {
    const full = asArray(certificationsQuery.data).find(
      (c) => c.certificationId === orgCert?.certificationId
    )
    if (!full) return null
    // Stamp the certification id onto each lesson's parent chain so the
    // "Add question" deep link doesn't need a second lookup.
    return {
      ...full,
      majorCategory: (full.majorCategory ?? []).map((major) => ({
        ...major,
        middleCategory: (major.middleCategory ?? []).map((middle) => ({
          ...middle,
          __certificationId: full.certificationId,
        })),
      })),
    }
  }, [certificationsQuery.data, orgCert?.certificationId])

  const isLoading =
    enterpriseLoading ||
    (enterprise && data.isLoading) ||
    certificationsQuery.isLoading ||
    groupsQuery.isLoading

  if (isLoading) return <EnterpriseLoadingSkeleton />
  if (enterpriseError) return <EnterpriseErrorState onRetry={refetchEnterprise} />
  if (!enterprise || !orgCert || !certification) {
    return (
      <div className="space-y-6">
        <Link
          to="/enterprise/certifications"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to Certifications
        </Link>
        <EnterpriseEmptyState
          title="Certification not found"
          description="This certification allocation could not be found."
        />
      </div>
    )
  }

  const majorCategories = certification.majorCategory ?? []
  const totalLessons = majorCategories.reduce(
    (total, major) =>
      total +
      (major.middleCategory ?? []).reduce(
        (subtotal, middle) => subtotal + (middle.lessons?.length ?? 0),
        0
      ),
    0
  )
  const used = orgCert.usedSlots ?? 0
  const total = orgCert.totalSlots ?? 0

  return (
    <div className="space-y-6">
      <Link
        to="/enterprise/certifications"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back to Certifications
      </Link>

      <EnterprisePageHeader
        title={certification.title}
        subtitle={certification.description || "No description available."}
        actions={<EnterpriseStatusBadge status={orgCert.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Layers3Icon className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {majorCategories.length}
              </p>
              <p className="text-xs text-muted-foreground">Major categories</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpenIcon className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xl font-semibold tabular-nums">{totalLessons}</p>
              <p className="text-xs text-muted-foreground">Lessons</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Slot usage</span>
              <span className="tabular-nums">
                {used} / {total}
              </span>
            </div>
            <Progress
              className="mt-2"
              value={total > 0 ? (used / total) * 100 : 0}
              aria-label="Slot usage"
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="curriculum">
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum" className="space-y-4">
          {majorCategories.length === 0 ? (
            <EnterpriseEmptyState
              icon={Layers3Icon}
              title="No content yet"
              description="This certification has no categories or lessons yet."
            />
          ) : (
            <div className="space-y-6">
              {majorCategories.map((major, majorIndex) => (
                <section key={major.majorCategoryId ?? majorIndex} className="space-y-2">
                  <p className="text-sm font-semibold">
                    <span className="text-primary">
                      Major Category {majorIndex + 1}:
                    </span>{" "}
                    {major.title}
                  </p>
                  <div className="space-y-2">
                    {(major.middleCategory ?? []).map((middle, middleIndex) => (
                      <MiddleCategoryRow
                        key={middle.middleCategoryId ?? middleIndex}
                        middleCategory={middle}
                        orgCertId={numericOrgCertId}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="flex justify-end">
            <Button asChild size="sm">
              <Link to={`/enterprise/groups?orgCertId=${numericOrgCertId}`}>
                <UsersRoundIcon className="size-4" aria-hidden="true" />
                Manage groups
              </Link>
            </Button>
          </div>
          {groups.length === 0 ? (
            <EnterpriseEmptyState
              icon={UsersRoundIcon}
              title="No groups yet"
              description="Create a group under this certification to assign a leader and start inviting learners."
              action={
                <Button asChild size="sm">
                  <Link to={`/enterprise/groups?orgCertId=${numericOrgCertId}`}>
                    Create group
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <Card key={group.enterpriseGroupId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{group.groupName}</CardTitle>
                    <CardDescription>
                      {group.groupDescription || "No description."}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground">
                      {group.usedSlots ?? 0} / {group.totalSlots ?? 0} slot
                      {(group.totalSlots ?? 0) === 1 ? "" : "s"} used
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          {groupInvitations.length === 0 ? (
            <EnterpriseEmptyState
              icon={MailIcon}
              title="No invitations yet"
              description="Invitations are sent by each group's leader, from within the group."
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {groupInvitations.map((inv) => (
                <div
                  key={inv.invitationId}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.groupName} · {formatDate(inv.sentAt)}
                    </p>
                  </div>
                  <EnterpriseStatusBadge status={inv.status} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
