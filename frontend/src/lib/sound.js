/**
 * The product's sound effects.
 *
 * Synthesised, not sampled. A short chime is a handful of oscillators and an
 * envelope, and generating it here means there is no audio file to ship, no
 * licence to honour for a sound someone else recorded, no network request at
 * the exact moment the learner is being congratulated, and nothing to break
 * offline. It also means the chime can be tuned by editing numbers rather than
 * by sourcing a new file.
 *
 * Everything below fails silently. A browser that blocks audio, a device with
 * no output, a `AudioContext` the autoplay policy refuses to resume — none of
 * those are errors the learner needs to hear about, and an unlockable
 * achievement that throws because a sound could not play would be a far worse
 * bug than a missing sound.
 */

const PREF_KEY = "rebyu.sound"

/**
 * Whether sound is on for this device.
 *
 * Device-local rather than an account preference: which of your machines has
 * speakers, and whether you are studying next to someone, is a property of
 * where you are sitting, not of who you are. Syncing it to the server would
 * mute your laptop because you once muted your phone on a train.
 *
 * Defaults on. The only sound in the product marks a rare event the learner
 * worked for; shipping it silent by default would mean nobody ever discovers
 * it exists.
 */
export function isSoundEnabled() {
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off"
  } catch {
    // Private mode, blocked storage. Fall back to the default rather than
    // letting a storage exception decide the answer.
    return true
  }
}

export function setSoundEnabled(enabled) {
  try {
    window.localStorage.setItem(PREF_KEY, enabled ? "on" : "off")
  } catch {
    /* Preference simply will not persist. The toggle still works this session. */
  }
}

/* One context for the page. Constructing one per sound leaks them — browsers
   cap the number a document may hold, and past the cap every later sound is
   silent, which would make the chime work until the learner had earned enough
   achievements to care about it. */
let context = null

function getContext() {
  if (context) return context
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    return null
  }
  return context
}

/**
 * One note of the chime.
 *
 * Triangle rather than sine: a sine is so pure it reads as a test tone, and
 * the triangle's odd harmonics are what make it sound like an instrument. The
 * envelope matters more than the waveform — the 12ms attack is there to stop
 * the click a square-edged start produces, and the long exponential release is
 * what makes the notes ring into each other instead of stopping dead.
 */
function playNote(ctx, frequency, startAt, duration, peak) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = "triangle"
  osc.frequency.value = frequency

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012)
  // `exponentialRampToValueAtTime` cannot reach zero, so it lands just above
  // it and the stop below cuts the remainder inaudibly.
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/* A major triad climbing into its own octave: the "you did it" cadence, and
   the reason it reads as arrival rather than as a notification is that the
   last note lands on the root an octave up rather than on a new colour. */
const ACHIEVEMENT_NOTES = [523.25, 659.25, 783.99, 1046.5]

/**
 * The sound of unlocking an achievement.
 *
 * Deliberately the only one in the product. A sound per interaction turns into
 * noise the learner mutes, and muting takes the rare moment with it — so the
 * rare moment is the only thing that makes any.
 */
export function playAchievementChime() {
  if (!isSoundEnabled()) return
  // Nothing announces itself to a tab nobody is looking at, and a chime from a
  // background tab is the single most irritating thing a web app can do.
  if (typeof document !== "undefined" && document.hidden) return

  const ctx = getContext()
  if (!ctx) return

  try {
    /* Autoplay policy suspends a context created before the first gesture.
       Resuming is a promise, and it rejects when there has been no gesture at
       all — which is fine: an achievement always follows one, so by the time
       this runs the resume succeeds. The catch is for the paths where it does
       not, so a refusal stays silent instead of surfacing as an unhandled
       rejection in the console. */
    const resumed = ctx.state === "suspended" ? ctx.resume() : Promise.resolve()

    resumed
      .then(() => {
        const now = ctx.currentTime
        ACHIEVEMENT_NOTES.forEach((frequency, index) => {
          // 70ms apart: fast enough to read as one gesture rather than four
          // separate beeps, slow enough that the notes are distinguishable.
          playNote(ctx, frequency, now + index * 0.07, 0.55, 0.13)
        })
      })
      .catch(() => {})
  } catch {
    /* Any failure here is a sound that did not play. Nothing else depends on it. */
  }
}
