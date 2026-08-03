import { Link } from "react-router-dom"
import { CompassIcon, HomeIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { roleHomePath, useAuth } from "@/context/auth-context.jsx"

export default function NotFoundPage() {
  const { user, status } = useAuth()
  const homePath = status === "authenticated" ? roleHomePath(user?.role) : "/"

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
      <CompassIcon className="size-12 text-muted-foreground" aria-hidden="true" />

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you're looking for doesn't exist or may have moved.
        </p>
      </div>

      <Button asChild>
        <Link to={homePath}>
          <HomeIcon aria-hidden="true" />
          Back to safety
        </Link>
      </Button>
    </div>
  )
}
