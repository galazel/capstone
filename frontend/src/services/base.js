import axios from "axios"
import { fetchAuthSession } from "aws-amplify/auth"

// In development, Vite forwards /api to the local backend. In deployed builds,
// use the public API URL supplied by the host (for example, Railway).
const deployedApiOrigin = import.meta.env.VITE_API_URL?.replace(/\/+$/, "")

export const API = import.meta.env.DEV
  ? "/api"
  : `${deployedApiOrigin || "http://localhost:8080"}/api`

/* The localhost fallback above is right for the local Docker stack, where the
   browser really is on localhost and the API really is on 8080. Anywhere else
   it is a build that was never told where its API lives, and the way that
   failure presents -- a CORS error naming localhost, from a page served over
   https -- points at the server rather than at the missing build argument.
   
   So it says so itself, once, at startup. Checked against the page's own host
   rather than a mode flag: `import.meta.env.DEV` is already false in every
   built image, including the one that is correctly using localhost. */
if (
  !import.meta.env.DEV &&
  !deployedApiOrigin &&
  typeof window !== "undefined" &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname)
) {
  console.error(
    `[REBYU] This build has no VITE_API_URL, so it is calling ${API} — the ` +
      `machine running the browser, not the server. Rebuild the frontend image ` +
      `with --build-arg VITE_API_URL=https://your-api-host (Vite inlines it at ` +
      `build time; setting it in the container's environment has no effect).`
  )
}

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
