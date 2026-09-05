import { Component, lazy } from "react"

/**
 * Route-level code splitting that survives a deploy.
 *
 * Every route in this app is a lazily imported chunk whose filename carries a
 * content hash, so a deploy replaces `learner-layout-Dw_vzAVY.js` with a file
 * of a different name. A browser that already has the old `index.html` open
 * goes on asking for the old names: mid-deploy those requests are reset, and
 * afterwards they are simply gone. React's `lazy` turns that into a thrown
 * promise rejection, and with no error boundary above it the whole route tree
 * unmounts -- the learner is left looking at a white page, with the failure
 * only visible in the console. It does not recover on its own, because
 * nothing retries and nothing tells them to reload.
 *
 * The fix is in two halves, and both are needed: this file retries the import
 * once and then reloads the page, and `RouteErrorBoundary` catches whatever
 * gets through so the worst case is a panel with a button rather than nothing
 * at all.
 */

/* Long enough that a genuinely broken chunk cannot put the tab in a reload
   loop -- after an automatic reload, a second failure inside this window is
   treated as real and handed to the boundary instead. */
const RELOAD_COOLDOWN_MS = 30_000
const RELOAD_MARKER = "rebyu-chunk-reload-at"

function lastReloadWasRecent() {
  try {
    const at = Number(window.sessionStorage.getItem(RELOAD_MARKER))
    return Number.isFinite(at) && Date.now() - at < RELOAD_COOLDOWN_MS
  } catch {
    // Storage blocked. Treat it as "recently reloaded" so a private window
    // errs toward showing the boundary rather than toward reloading forever.
    return true
  }
}

function markReload() {
  try {
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()))
  } catch {
    /* Nothing to do; the check above already fails closed. */
  }
}

/**
 * `lazy`, plus one retry and a reload.
 *
 * The retry covers the narrow case the reload cannot: a chunk request that was
 * reset while the server was being replaced, where the file still exists under
 * the same name a moment later. Only when the second attempt fails too is this
 * taken as a stale document, which a reload fixes by fetching the new
 * `index.html` and with it the new chunk names.
 */
export function lazyRoute(factory) {
  return lazy(() =>
    factory().catch(() =>
      factory().catch((error) => {
        if (lastReloadWasRecent()) {
          // Already tried that. Let the boundary explain it instead of
          // bouncing the tab indefinitely.
          throw error
        }

        markReload()
        window.location.reload()

        // Never settles: the reload takes the page before React needs an
        // answer, and resolving with anything here would flash a wrong route.
        return new Promise(() => {})
      })
    )
  )
}

/**
 * The last line of defence for a route that will not render.
 *
 * Deliberately plain -- no design system imports, no hooks, nothing that could
 * itself be in a chunk that failed to load. Whatever is broken, this has to be
 * able to draw.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    /* A failed import reads differently from a crash: one is almost always a
       new version of the app being available, the other is a bug. Saying which
       decides whether reloading is worth the learner's time. */
    const isLoadFailure = /dynamically imported module|Importing a module script|Failed to fetch/i.test(
      String(error?.message ?? "")
    )

    return (
      <div
        role="alert"
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: "#3c3c3c",
          background: "#f7f7f7",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 800, margin: 0 }}>
            {isLoadFailure ? "A new version is ready" : "Something went wrong"}
          </p>
          <p style={{ marginTop: "0.5rem", lineHeight: 1.6, color: "#777" }}>
            {isLoadFailure
              ? "This page was updated while you had it open. Reload to pick up the new version."
              : "This page could not be displayed. Reloading usually clears it."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.25rem",
              minHeight: "44px",
              padding: "0 1.5rem",
              border: 0,
              borderRadius: "12px",
              background: "#1b6ef3",
              boxShadow: "0 4px 0 0 #1553c4",
              color: "#fff",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
