import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.jsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { BrowserRouter } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { XpAwardModal } from "@/components/learner/xp-award-modal.jsx"
import { configureAmplify } from "@/lib/amplify.js"
import { AuthProvider } from "@/context/auth-context.jsx"
import { MotionConfig } from "framer-motion"

configureAmplify()

const rootElement = document.getElementById("root")
/* React Query's own defaults are staleTime 0 and refetchOnWindowFocus true,
   which means every cached read is considered stale the instant it lands: going
   back to a page you were just on refetches it in full, and so does alt-tabbing
   away and back. Against this API -- whose database is a Neon instance in
   ap-southeast-1, ~50ms per round trip -- that turns navigation the cache could
   answer instantly into a fresh wait, every time.

   Thirty seconds is short enough that nothing on screen is meaningfully out of
   date and long enough to cover the navigation the learner is actually doing:
   opening a lesson and coming back, checking analytics and returning to the
   dashboard. It changes nothing about correctness, because the things that MUST
   be current are not left to a timer -- submitting an assessment, completing a
   lesson and every other mutation invalidate their queries explicitly, which
   refetches regardless of staleness. The seventy-odd queries that already set
   their own staleTime keep it; this is only the floor for the ones that did
   not.

   Assessment answers, scores, attempts and results are never served stale by
   this: an attempt's result is immutable once written, and the in-progress
   attempt is server-owned state read once at start rather than polled. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Three attempts on a genuinely broken endpoint is three round trips of
      // waiting before the user is told anything.
      retry: 1,
    },
  },
})
if (!rootElement) throw new Error("Root element not found")

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      {/* `reducedMotion="user"` makes every framer-motion animation in the app
          fall back to an opacity change when the OS asks for reduced motion.
          Set once here so no individual component has to remember to check the
          media query. The CSS motion layer opts out separately, at the foot of
          rebyu-ds.css. */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <TooltipProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <App />
                <Toaster />
                {/* Hosted here, not inside a page: submitting an assessment
                    navigates to the results page straight after awarding, and
                    a modal owned by the submitting page would unmount with
                    it. */}
                <XpAwardModal />
              </AuthProvider>
            </QueryClientProvider>
          </TooltipProvider>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  </StrictMode>
)
