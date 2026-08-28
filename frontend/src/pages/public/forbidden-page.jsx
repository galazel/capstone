import { Link } from "react-router-dom"
import { HomeIcon, ShieldXIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { roleHomePath, useAuth } from "@/context/auth-context.jsx"

export default function ForbiddenPage() {
  const { user, status } = useAuth()
  const homePath = status === "authenticated" ? roleHomePath(user?.role) : "/"

  return (
    <div className="rebyu-ds rb-light-only flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
      <ShieldXIcon className="size-12 text-muted-foreground" aria-hidden="true" />

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">403</p>
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You don't have permission to view this page. If you think this is a mistake, contact
          your administrator.
        </p>
      </div>

      <Button asChild>
        <Link to={homePath}>
          <HomeIcon aria-hidden="true" />
          Go to my dashboard
        </Link>
      </Button>
    </div>
  )
}
