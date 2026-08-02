import { Check } from "@/components/icons"
import { Link } from "react-router-dom"

import { BrandLogo } from "@/components/brand-logo"
import { BackButton } from "@/components/rebyu/rebyu-ui.jsx"

/**
 * Two-column frame shared by every auth route.
 *
 * On the system's terms rather than its own: the shell used to run a private
 * hex palette (#273452, #2F7DD3, #E0E7EF) and a stock photograph, which meant
 * the first screen a learner ever saw looked like a different product from the
 * one behind it. It now sits inside `.rebyu-ds` and takes its type, colour and
 * controls from the same tokens as the rest of the app.
 *
 * `side` alternates which column the form occupies. Sign-in and sign-up are
 * the two screens people bounce between, and moving the form across on the
 * switch makes the change of screen unmistakable — you cannot mistake register
 * for a login page that failed to submit.
 */

const BENEFITS = [
  "Find weak topics before you begin",
  "Follow a study plan shaped by your progress",
  "Build confidence through structured practice",
]

export default function AuthShell({
  title,
  description,
  children,
  footer,
  compact = false,
  side = "left",
}) {
  const formFirst = side === "left"

  return (
    <main
      className={`rebyu-ds public-auth-shell min-h-dvh bg-rb-polar text-rb-eel lg:grid lg:grid-cols-2 ${
        compact ? "lg:h-dvh lg:overflow-hidden" : ""
      }`}
    >
      <section
        className={`relative flex min-h-dvh flex-col px-5 sm:px-8 lg:px-12 xl:px-16 ${
          compact ? "py-4 sm:py-5 lg:h-dvh lg:min-h-0" : "py-5 sm:py-7"
        } ${formFirst ? "lg:order-1" : "lg:order-2"}`}
      >
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rb-macaw"
          >
            <BrandLogo className="size-9" />
            <span className="font-rb-display text-xl font-extrabold lowercase tracking-tight text-rb-eel">
              rebyu
            </span>
          </Link>

          <BackButton asChild size="sm" label="Back to home">
            <Link to="/" />
          </BackButton>
        </div>

        <div
          className={`mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center ${
            compact ? "py-5 sm:py-6" : "py-12 sm:py-16"
          }`}
        >
          <div className={`border-b-2 border-rb-swan ${compact ? "mb-5 pb-4" : "mb-8 pb-7"}`}>
            <p className="rb-eyebrow">Certification preparation</p>
            <h1 className={`rb-display mt-3 ${compact ? "rb-display-md" : "rb-display-lg"}`}>
              {title}
            </h1>
            {description ? <p className="rb-body mt-3 max-w-md">{description}</p> : null}
          </div>

          {children}

          {footer ? (
            <div
              className={`rb-body border-t-2 border-rb-swan text-center text-sm ${
                compact ? "mt-4 pt-4" : "mt-7 pt-6"
              }`}
            >
              {footer}
            </div>
          ) : null}
        </div>

        <p className="text-xs font-semibold text-rb-hare">© {new Date().getFullYear()} Rebyu</p>
      </section>

      {/* The wordmark panel, in place of the stock photograph that used to
          live here. The photo said nothing the page did not already say and
          cost a hero-sized download on the one route where nobody is signed in
          yet; the oversized lowercase mark is the same device the footer ends
          on, so the product closes and opens on the same note. */}
      <aside
        className={`relative hidden min-h-dvh overflow-hidden bg-rb-feather lg:flex lg:flex-col lg:justify-end ${
          compact ? "lg:h-dvh lg:min-h-0" : ""
        } ${formFirst ? "lg:order-2" : "lg:order-1"}`}
      >
        {/* Colour is set inline, not with `text-white`: `.rebyu-ds .rb-display`
            and `.rb-eyebrow` both pin a colour at two-class specificity, which
            a single utility class cannot outrank. Everything else on this
            panel has no competing rule and takes its utility normally. */}
        <div className="relative px-12 pt-16 xl:px-16">
          <p className="rb-eyebrow" style={{ color: "rgb(255 255 255 / 0.75)" }}>
            One connected review experience
          </p>
          <h2
            className="rb-display rb-display-lg mt-4 max-w-xl"
            style={{ color: "var(--color-rb-snow)" }}
          >
            prepare with clarity. walk into the exam confident.
          </h2>

          <ul className="mt-8 grid max-w-xl gap-3 border-t-2 border-white/25 pt-7">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-sm font-semibold text-white/90">
                <Check className="size-4 shrink-0 text-rb-bee" aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Bled off the bottom edge on purpose — a wordmark that fits inside
            its box reads as a logo placement, not as the surface itself. */}
        <span
          aria-hidden="true"
          className="pointer-events-none mt-10 block select-none overflow-hidden whitespace-nowrap pl-8 font-rb-display text-[15vw] font-black lowercase leading-[0.66] tracking-tight text-white/20"
        >
          rebyu
        </span>
      </aside>
    </main>
  )
}
