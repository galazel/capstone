import { Skeleton } from "@/components/ui/skeleton"

/**
 * What a portal shows while the next page's code is still arriving.
 *
 * This exists because the app had one `<Suspense>` around the entire route
 * tree, with the boot screen as its fallback. Every navigation therefore tore
 * down the whole shell -- nav, sidebar, the lot -- and replaced it with a
 * full-screen animated splash, for however long the lazy chunk took. Moving the
 * boundary inside each layout keeps the chrome painted and confines the wait to
 * the one region that is actually changing.
 *
 * Deliberately generic. A route fallback cannot know which page is coming, so
 * anything shaped like a specific page would be a lie on every other route --
 * a dashboard's four stat tiles standing in for a settings form. It promises
 * only what is always true: a heading, then content. The moment the page's own
 * code lands, its `isLoading` skeleton takes over with the accurate shape.
 *
 * No animation beyond the shimmer the `Skeleton` primitive already carries.
 * This is on screen for a few hundred milliseconds; anything that has to build
 * up to look right would only ever be seen half-built.
 */
export function PortalPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      {/* The page header: a title, and the line of context that sits under it. */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 max-w-full rounded-rb-control" />
        <Skeleton className="h-4 w-96 max-w-full rounded-rb-control" />
      </div>

      {/* Content. Three blocks of unequal height rather than a neat grid --
          an even grid reads as a specific layout, which is the thing this
          must not claim to know. */}
      <Skeleton className="h-40 rounded-rb-card" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-rb-card" />
        <Skeleton className="h-56 rounded-rb-card" />
      </div>
    </div>
  )
}
