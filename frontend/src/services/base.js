import axios from "axios"
import { fetchAuthSession } from "aws-amplify/auth"

// In development, Vite forwards /api to the local backend. In deployed builds,
// use the public API URL supplied by the host (for example, Railway).
const deployedApiOrigin = import.meta.env.VITE_API_URL?.replace(/\/+$/, "")

export const API = import.meta.env.DEV
  ? "/api"
  : `${deployedApiOrigin || "http://localhost:8080"}/api`

// Attaches the Cognito access token when a session exists. Exported because
// the SSE notification stream needs the same bearer token but is opened with
// fetch (not axios), so it can't go through base() below.
export async function currentAccessToken() {
  try {
    const session = await fetchAuthSession()
    return session?.tokens?.accessToken?.toString() ?? null
  } catch {
    return null
  }
}

/**
 * The server's own explanation for a failed request. Our API returns
 * {status, message, fieldErrors}, and swallowing that in favour of a generic
 * "could not do X" turns a diagnosable failure into a guessing game.
 */
export function apiMessage(error, fallback) {
  const message = error?.response?.data?.message
  return typeof message === "string" && message.trim() ? message : fallback
}

export async function base(endpoint, options = {}) {
  const headers = { ...(options.headers ?? {}) }
  if (!headers.Authorization) {
    const token = await currentAccessToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  const hadToken = Boolean(headers.Authorization)

  try {
    const response = await axios({
      url: `${API}/${endpoint}`,
      method: options.method || "GET",
      data: options.data,
      responseType: options.responseType,
      headers,
      // Real byte-level upload progress, for callers that send files. Without
      // this a large multipart POST is indistinguishable from a hung request,
      // which is what forced the old generation UI to fake progress on a timer.
      onUploadProgress: options.onUploadProgress,
    })

    return response.data
  } catch (error) {
    // A 401 on a request we sent WITH a token means the session expired or was
    // revoked mid-use. Send the user back to sign in (guarded against loops).
    if (
      error.response?.status === 401 &&
      hadToken &&
      !window.location.pathname.startsWith("/login")
    ) {
      sessionStorage.setItem("rebyu_session_expired", "1")
      window.location.assign("/login")
    }

    console.error(
        `API request failed: ${options.method || "GET"} /${endpoint}`,
        error.response?.data || error.message
    )

    throw error
  }
}
