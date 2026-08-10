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
const queryClient = new QueryClient()
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
