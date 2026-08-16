import { useQuery } from "@tanstack/react-query"
import { MegaphoneIcon, PinIcon } from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getMyAnnouncements } from "@/services/enterpriseService.js"

function formatWhen(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

/**
 * Announcements posted by the leader of the learner's group, shown on the
 * certification they belong to.
 *
 * Renders nothing at all when the learner has no announcements -- most
 * learners are not in an organization group, and an empty "Announcements"
 * heading on every certification page would be noise rather than information.
 */
export function LearnerAnnouncements({ certificationId }) {
  const query = useQuery({
    queryKey: ["learner-announcements", certificationId ?? "all"],
    queryFn: () => getMyAnnouncements(certificationId),
    enabled: certificationId == null || Number.isFinite(Number(certificationId)),
    staleTime: 60_000,
    retry: 1,
  })

  const announcements = Array.isArray(query.data) ? query.data : []

  // Nothing while loading, for the same reason as nothing when empty: most
  // learners are not in an organization group, so the usual outcome of this
  // request is that this component draws nothing at all. A skeleton held a
  // 112px blank band open on every certification page for a section that
  // almost never arrives -- it read as a layout gap, not as loading.
  if (query.isLoading || query.isError || announcements.length === 0) {
    return null
  }

  return (
    <section className="space-y-4" aria-labelledby="course-announcements">
      <div>
        <h2 id="course-announcements" className="flex items-center gap-2 text-2xl font-bold">
          <MegaphoneIcon className="size-5 text-primary" aria-hidden="true" />
          Announcements
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Updates from your instructor for this course.
        </p>
      </div>

      <div className="space-y-3">
        {announcements.map((announcement) => (
          <Card
            key={announcement.groupAnnouncementId}
            className={announcement.pinned ? "border-primary/40 bg-primary/5" : undefined}
          >
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 font-semibold text-foreground">{announcement.title}</h3>
                {announcement.pinned ? (
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <PinIcon className="size-3" aria-hidden="true" />
                    Pinned
                  </Badge>
                ) : null}
              </div>

              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {announcement.body}
              </p>

              <p className="mt-3 text-xs text-muted-foreground">
                {announcement.authorName}
                {announcement.groupName ? ` · ${announcement.groupName}` : ""}
                {announcement.createdAt ? ` · ${formatWhen(announcement.createdAt)}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export default LearnerAnnouncements
