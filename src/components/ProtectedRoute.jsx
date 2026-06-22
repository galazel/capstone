import React from "react"
import NotFound from "./NotFound"

function ProtectedRoute() {
  const token = localStorage.getItem("admin")
  if(!token)
    return <NotFound/>
  return <div>ProtectedRoute</div>
}

export default ProtectedRoute
