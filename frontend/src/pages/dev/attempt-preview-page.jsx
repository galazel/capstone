/**
 * Dev-only screenshot harness for the assessment attempt page.
 *
 * Renders the REAL `LearnerAssessmentAttemptPage` — no fork, no lookalike —
 * against a fixture attempt, so the landing hero can carry screenshots of the
 * environment learners actually sit exams in. When the attempt page changes,
 * re-shooting the hero is a matter of reopening this route.
 *
 * Nothing here reaches the network: an axios adapter answers the attempt
 * endpoints locally, and the learner identity is seeded into localStorage so
 * the page never asks who is signed in. The route is registered behind
 * `import.meta.env.DEV` in `App.jsx`, so it does not exist in a production
 * bundle.
 */
import { useEffect } from "react"
import axios from "axios"

import LearnerAssessmentAttemptPage from "@/pages/learner/assessments/learner-assessment-attempt-page.jsx"
import { buildAttemptFixture, resolveShowcaseId } from "./attempt-preview-fixtures.js"

const PREVIEW_LEARNER_ID = "999001"

/* Seeded at module scope, not in an effect: `getCurrentLearnerIdentity()` reads
   localStorage during the attempt page's first render, which happens before any
   effect of ours could run. */
if (localStorage.getItem("learnerId") !== PREVIEW_LEARNER_ID) {
  localStorage.setItem("learnerId", PREVIEW_LEARNER_ID)
  localStorage.setItem("userId", PREVIEW_LEARNER_ID)
  localStorage.setItem("role", "LEARNER")
  localStorage.setItem("name", "Preview Learner")
}

// A fresh idempotency key each load, so the page always starts a new attempt
// rather than resuming one and firing a toast into the screenshot.
sessionStorage.clear()

function localResponse(config, data) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  })
}

/* Answers every endpoint the attempt page and its two workspace layouts touch.
   Writes (autosave, flag, skip, current-item) return an empty body — the page
   only cares that they resolve. Run/Check return the same "not run" shape the
   stubbed server-side executor returns, so nothing is fake-scored here either. */
function installPreviewAdapter() {
  if (axios.defaults.__rebyuPreviewAdapter) return
  axios.defaults.__rebyuPreviewAdapter = true

  axios.interceptors.request.use((config) => {
    const url = config.url ?? ""
    if (!url.includes("/api/")) return config

    if (/\/learner\/assessments\/[^/]+\/attempts$/.test(url)) {
      // `?item=programming` (or a raw attemptQuestionId) opens the attempt on
      // that question, so each question type is one URL rather than a click
      // path a screenshot script would have to reproduce.
      const requested = new URLSearchParams(window.location.search).get("item")
      config.adapter = (request) =>
        localResponse(request, buildAttemptFixture(resolveShowcaseId(requested)))
      return config
    }

    if (/\/learner\/assessment-attempts\//.test(url)) {
      if (/\/executions/.test(url)) {
        config.adapter = (request) => localResponse(request, [])
        return config
      }
      if (/\/(run|check|check-diagram)$/.test(url)) {
        config.adapter = (request) =>
          localResponse(request, {
            status: "NOT_RUN",
            message: "The executor is not enabled in preview.",
            testCases: [],
            rubric: [],
          })
        return config
      }
      config.adapter = (request) => localResponse(request, {})
      return config
    }

    // Anything else this page might reach for (profile, files) resolves empty
    // rather than erroring into a toast over the screenshot.
    config.adapter = (request) => localResponse(request, {})
    return config
  })
}

installPreviewAdapter()

export default function AttemptPreviewPage() {
  useEffect(() => {
    // The attempt page registers a beforeunload guard; without this, navigating
    // between screenshots raises a browser confirm dialog.
    const stop = (event) => {
      event.stopImmediatePropagation()
    }
    window.addEventListener("beforeunload", stop, true)
    return () => window.removeEventListener("beforeunload", stop, true)
  }, [])

  return <LearnerAssessmentAttemptPage />
}
