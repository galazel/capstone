import { useEffect, useRef, useState } from "react"

import { getKnowledgeCheckOffer } from "@/services/knowledgeCheckService.js"

/** Never before this much of the lesson has been read, never after this much. */
const MIN_DEPTH = 0.25
const MAX_DEPTH = 0.75

/**
 * Set once the server says this learner is not eligible, and never cleared.
 *
 * The cooldown is a day, so the first "not now" answers every lesson they will
 * open in this sitting. Without this, a learner reading ten lessons in an
 * evening would send ten requests to be told the same thing ten times. Module
 * scope rather than a ref because it has to outlive the lesson page unmounting
 * as they move between lessons -- a page-local ref would forget on every
 * navigation, which is exactly the case this exists to cover.
 *
 * A reload clears it, which is the right amount of forgetting: the server is
 * still the authority, so the worst a stale value can do is cost one check.
 */
let suppressedForSession = false

/**
 * How long the learner must dwell past the trigger point before it fires.
 *
 * A fast scroll to the bottom is someone looking for one specific thing, not
 * someone studying. Interrupting that is pure obstruction, so the depth has to
 * still be held a moment later for the check to fire.
 */
const DWELL_MS = 1200

/**
 * Fires a pop-up knowledge check at a random point while a lesson is being read.
 *
 * <h3>What "random" means here</h3>
 * A scroll depth between a quarter and three quarters of the way down is drawn
 * once per lesson opening. The check fires when the learner reaches it and is
 * still there a moment later. Drawing the point up front rather than rolling
 * dice on every scroll event is what makes it unpredictable but not erratic:
 * one lesson, one possible interruption, at a place neither the learner nor the
 * author can anticipate.
 *
 * <p>The bounds matter. Before a quarter the learner has read nothing and the
 * interruption lands as noise; after three quarters they can see the end of the
 * lesson and being stopped there is maddening.
 *
 * <h3>Why it asks the server before interrupting</h3>
 * Eligibility -- the cooldown, and whether they have finished enough lessons to
 * be tested on -- is the server's to judge. Asking first means a learner who is
 * not eligible never sees a modal that then has to be taken away again. The
 * request is made once, at the trigger point, not on every scroll.
 */
export function useKnowledgeCheckTrigger({ lessonId, enabled }) {
  const [offer, setOffer] = useState(null)

  /* One interruption per lesson opening, decided here rather than by the
     modal: once it has fired, scrolling back up and down again must not
     re-arm it. */
  const firedRef = useRef(false)

  /* Redrawn per lesson, so the same lesson read twice is not interrupted in
     the same place both times. */
  const depthRef = useRef(null)

  useEffect(() => {
    firedRef.current = false
    depthRef.current = MIN_DEPTH + Math.random() * (MAX_DEPTH - MIN_DEPTH)
    setOffer(null)
  }, [lessonId])

  useEffect(() => {
    if (!enabled || !lessonId || suppressedForSession) return undefined

    let cancelled = false
    let dwellTimer = null

    function scrolledFraction() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      // A lesson shorter than the viewport cannot be scrolled through, so
      // there is no reading progress to trigger on.
      if (scrollable <= 0) return 0
      return window.scrollY / scrollable
    }

    function pastTriggerPoint() {
      return scrolledFraction() >= depthRef.current
    }

    function fire() {
      if (firedRef.current || cancelled) return
      firedRef.current = true

      getKnowledgeCheckOffer(lessonId)
        .then((result) => {
          if (cancelled) return
          if (result?.available) {
            setOffer(result)
            return
          }
          /* Not eligible -- on cooldown for the rest of the day, or not enough
             finished lessons to draw on. Either way the answer will not change
             within this sitting, so stop asking entirely. */
          suppressedForSession = true
        })
        .catch(() => {
          /* An optional study prompt must never surface an error over the
             lesson. Staying silent costs the learner one check. */
        })
    }

    function onScroll() {
      if (firedRef.current) return

      if (!pastTriggerPoint()) {
        // Scrolled back above the point before the dwell elapsed: they were
        // passing through, not settling.
        if (dwellTimer) {
          clearTimeout(dwellTimer)
          dwellTimer = null
        }
        return
      }

      if (dwellTimer) return
      dwellTimer = setTimeout(() => {
        dwellTimer = null
        if (pastTriggerPoint()) fire()
      }, DWELL_MS)
    }

    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      cancelled = true
      if (dwellTimer) clearTimeout(dwellTimer)
      window.removeEventListener("scroll", onScroll)
    }
  }, [enabled, lessonId])

  return {
    offer,
    /** Closes the prompt without re-arming it for this lesson opening. */
    dismiss: () => setOffer(null),
  }
}

export default useKnowledgeCheckTrigger
