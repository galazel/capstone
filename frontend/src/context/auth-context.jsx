import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  getAccessToken,
  loginWithCognito,
  logoutFromCognito,
  syncCurrentUser,
  completeTemporaryPassword,
} from "@/services/authService.js"

const AuthContext = createContext(null)

// Backend-confirmed authentication state. `user` is the safe DTO returned by
// /api/auth/me — the routing and role authority while signed in. localStorage
// is never treated as an authority here.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState("loading") // loading | authenticated | anonymous

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      setUser(null)
      setStatus("anonymous")
      return null
    }
    try {
      const currentUser = await syncCurrentUser()
      setUser(currentUser)
      setStatus("authenticated")
      // Keep legacy keys in sync so existing pages that read them keep
      // working; they are display hints only, never authorities.
      if (currentUser?.learnerId != null) {
        localStorage.setItem("learnerId", String(currentUser.learnerId))
      } else {
        localStorage.removeItem("learnerId")
        localStorage.removeItem("learner_id")
      }
      if (currentUser?.email) localStorage.setItem("email", currentUser.email)
      if (currentUser?.displayName) {
        localStorage.setItem("name", currentUser.displayName)
      }
      if (currentUser?.role) {
        localStorage.setItem("role", currentUser.role.toLowerCase())
      }
      return currentUser
    } catch (error) {
      // Token exists but the backend rejected or failed the sync.
      if (error?.response?.status === 401) {
        await logoutFromCognito().catch(() => {})
      }
      setUser(null)
      setStatus("anonymous")
      return null
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(
    async (email, password) => {
      const result = await loginWithCognito(email, password)
      
      if (result?.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        return { needsConfirmation: true }
      }
      // Check for the temporary password challenge (different step names in Amplify v6)
      if (result?.nextStep?.signInStep === "NEW_PASSWORD_REQUIRED" ||
          result?.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        return { needsNewPassword: true }
      }
      // Only sync with the backend once Cognito reports a completed sign-in.
      // Amplify may return isSignedIn=true with nextStep DONE, or (after the
      // stale-session retry) with no nextStep at all.
      if (result?.isSignedIn === false && result?.nextStep?.signInStep) {
        return { pendingStep: result.nextStep.signInStep }
      }
      const currentUser = await refresh()
      return { user: currentUser }
    },
    [refresh]
  )
  async function setNewPassword(newPassword) {
    try {
      const cognitoResult = await completeTemporaryPassword(newPassword)

      // After completing the NEW_PASSWORD_REQUIRED challenge, Cognito should
      // have signed in the user. The response from confirmSignIn may vary,
      // but if we get here without an exception, the challenge was completed.
      
      // Cognito login is now complete, so load your REBYU backend user and role.
      const user = await syncCurrentUser()

      if (!user) {
        throw new Error("Your password was created, but your account profile could not be loaded.")
      }

      setUser(user)

      return {
        user,
      }
    } catch (err) {
      console.error("setNewPassword error:", err?.message)
      throw err
    }
  }

  const logout = useCallback(async () => {
    await logoutFromCognito().catch(() => {})
    localStorage.removeItem("learnerId")
    localStorage.removeItem("email")
    localStorage.removeItem("name")
    localStorage.removeItem("role")
    localStorage.removeItem("rebyu_demo_role")
    setUser(null)
    setStatus("anonymous")
  }, [])

  const value = useMemo(
    () => ({ user, status, login, logout, refresh ,   setNewPassword,}),
    [user, status, login, logout, refresh,   setNewPassword,]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}

export function roleHomePath(role) {
  switch ((role ?? "").toUpperCase()) {
    case "ADMIN":
      return "/admin/dashboard"
    case "INSTITUTION":
    // An account the organization created for one of its people (a group
    // leader). Same portal as the organization's own account -- the dashboard
    // itself branches on whether they are the owner.
    case "INSTITUTION_MEMBER":
      return "/institution/dashboard"
    default:
      return "/learner/analytics"
  }
}
