import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth"

import { base } from "./base"

// Store the current sign-in context to handle multi-step challenges
// We use sessionStorage to persist the context across page navigation
let signInContext = null

function getStoredSignInContext() {
  try {
    const stored = sessionStorage.getItem("_amplify_signin_context")
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function storeSignInContext(context) {
  try {
    if (context) {
      sessionStorage.setItem("_amplify_signin_context", JSON.stringify({
        ...context,
        // Keep only serializable data
        isSignedIn: context?.isSignedIn,
        nextStep: context?.nextStep,
      }))
    } else {
      sessionStorage.removeItem("_amplify_signin_context")
    }
    signInContext = context
  } catch {
    signInContext = context
  }
}

// ---------------------------------------------------------------------------
// Cognito auth wrapper. All provider errors are mapped to safe messages —
// raw Cognito exception names never reach the UI.
// ---------------------------------------------------------------------------

const ERROR_MESSAGES = {
  UsernameExistsException: "This email may already be registered.",
  InvalidPasswordException:
      "Your password does not meet the required requirements.",
  InvalidParameterException:
      "Unable to process your details. Please check them and try again.",
  CodeMismatchException: "That code is not right. Check the newest email -- each resend replaces the last code.",
  CodeDeliveryFailureException: "We could not send the code to that address.",
  ExpiredCodeException: "That code has expired. Request a new one below.",
  UserNotConfirmedException:
      "Your account must be verified before signing in.",
  NotAuthorizedException: "Incorrect email or password.",
  UserNotFoundException: "Incorrect email or password.",
  LimitExceededException:
      "Too many attempts. Please wait a moment and try again.",
  TooManyRequestsException:
      "Too many attempts. Please wait a moment and try again.",
  PasswordResetRequiredException:
      "A password reset is required. Use Forgot Password to continue.",
  UserAlreadyAuthenticatedException:
      "You are already signed in. Redirecting you now.",
  EmptySignInUsername: "Enter your email address.",
  EmptySignInPassword: "Enter your password.",
}

export function toSafeAuthMessage(error, fallback = "Something went wrong. Please try again.") {
  const name = error?.name ?? error?.code

  /* Unmapped errors are logged before being flattened into the fallback.
     Raw provider names must never reach the UI, but they also must not vanish:
     with a fallback like "your code is invalid or expired", a network failure,
     a misconfigured pool and a throttle all present as the same sentence, and
     the learner is told to fix the one thing that is not wrong. The console
     keeps the truth for whoever has to work out why. */
  if (name && !ERROR_MESSAGES[name]) {
    console.warn(`Unmapped auth error: ${name}`, error?.message ?? error)
  }

  return ERROR_MESSAGES[name] ?? fallback
}

/**
 * Registers a learner, or picks up a registration that was abandoned.
 *
 * <p>Cognito creates the account the moment sign-up succeeds, in an UNCONFIRMED
 * state, and it stays there until a code is entered. Someone who closed the tab
 * on the verification screen therefore has an account they cannot use and
 * cannot re-create: signing up again is rejected with "already registered", and
 * signing in is rejected because they are unconfirmed. A dead end reached by
 * doing nothing more unusual than closing a tab.
 *
 * <p>So an existing username is not automatically a refusal. Cognito will only
 * resend a sign-up code to an account that is still unconfirmed -- a confirmed
 * one raises instead -- which makes the resend itself the test. If it goes
 * through, this was an abandoned registration and the caller is told to send
 * the learner to verification. If it does not, the email really is taken.
 *
 * @returns {{ status: "SIGNED_UP" | "RESENT_CODE" }}
 *   `RESENT_CODE` means no new account was created: a fresh code was sent to
 *   the one that was already waiting.
 */
export async function registerAccount({ email, password, firstName, lastName }) {
  // A lingering session from an earlier/incomplete flow makes Cognito reject a
  // fresh sign-up; clear it first so registering always works.
  await signOut().catch(() => {})

  try {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          ...(firstName ? { given_name: firstName } : {}),
          ...(lastName ? { family_name: lastName } : {}),
        },
      },
    })
    return { status: "SIGNED_UP" }
  } catch (error) {
    if ((error?.name ?? error?.code) !== "UsernameExistsException") {
      throw error
    }

    /* The password typed just now is deliberately not applied to the waiting
       account. Cognito offers no way to set it without proving ownership of
       the address, and anything that did would let a stranger overwrite the
       credentials of an unconfirmed account by knowing only its email. They
       verify with the code, then sign in with the password from their first
       attempt. */
    await resendSignUpCode({ username: email })
    return { status: "RESENT_CODE" }
  }
}

export function confirmRegistration(email, code) {
  return confirmSignUp({ username: email, confirmationCode: code })
}

export function resendVerificationCode(email) {
  return resendSignUpCode({ username: email })
}

export async function loginWithCognito(email, password) {
  try {
    const result = await signIn({ username: email, password })
    // Store the sign-in context for handling challenges across page navigation
    storeSignInContext(result)
    return result
  } catch (error) {
    // A stale/lingering Cognito session blocks a new sign-in with
    // "There is already a signed in user." Clear it and retry once so the
    // learner isn't stuck on the login page.
    if (error?.name === "UserAlreadyAuthenticatedException") {
      await signOut().catch(() => {})
      const result = await signIn({ username: email, password })
      storeSignInContext(result)
      return result
    }
    throw error
  }
}

export function logoutFromCognito() {
  storeSignInContext(null)
  return signOut()
}

export function requestPasswordReset(email) {
  return resetPassword({ username: email })
}

export function confirmPasswordReset(email, code, newPassword) {
  return confirmResetPassword({
    username: email,
    confirmationCode: code,
    newPassword,
  })
}

// Returns the current Cognito access token, or null when signed out.
export async function getAccessToken() {
  try {
    const session = await fetchAuthSession()
    return session?.tokens?.accessToken?.toString() ?? null
  } catch {
    return null
  }
}

// Backend-confirmed identity: links/provisions the REBYU account for the
// validated token and returns the safe user DTO (the routing authority).
export function syncCurrentUser() {
  return base("auth/me")
}

// Completes the temporary password challenge from Cognito.
// This is called after a user signs in with a temporary password and receives
// a NEW_PASSWORD_REQUIRED challenge. Responds with the new password.
export async function completeTemporaryPassword(newPassword) {
  try {
    // Try to get sign-in context from memory or storage
    const context = signInContext || getStoredSignInContext()
    
    if (!context) {
      throw new Error("No active sign-in session. Please sign in again.")
    }

    console.log("Completing temporary password challenge...")
    console.log("Using sign-in context:", context)
    
    // In Amplify v6, when you get NEW_PASSWORD_REQUIRED, you respond by
    // calling confirmSignIn with the new password as the challengeResponse.
    // The current auth session context is maintained internally by Amplify.
    const result = await confirmSignIn({
      challengeResponse: newPassword,
    })
    
    console.log("confirmSignIn result:", result)
    console.log("isSignedIn:", result?.isSignedIn)
    console.log("nextStep:", result?.nextStep)
    
    // Clear the stored sign-in context after successful completion
    storeSignInContext(null)
    
    return result
  } catch (error) {
    console.error("completeTemporaryPassword failed with error:", error)
    storeSignInContext(null)
    throw error
  }
}
