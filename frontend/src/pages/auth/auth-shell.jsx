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
      /* Only one half of the screen is coloured. The form side used to sit on
         the macaw wash, which put a blue behind the form and a louder blue
         beside it — two colours competing over a screen whose only job is to
         get you through a form. The form side is plain now. */
      className={`rebyu-ds public-auth-shell min-h-dvh bg-rb-snow text-rb-eel lg:grid lg:grid-cols-2 ${
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

      {/* The arena card at panel scale: the same macaw gradient cap and two
          oversized translucent bubbles the challenge cards, the dashboard's
          macaw tiles and the sign-in key all run on. Keeping this panel on the
          product's blue is the whole point — it is the first screen a learner
          sees, and it should be the same blue as everything behind it.

          Nothing but the wordmark sits on it. The eyebrow, headline and benefit
          list were three claims competing with the form for attention. */}
      <aside
        className={`relative hidden min-h-dvh overflow-hidden lg:flex lg:items-end lg:justify-end ${
          compact ? "lg:h-dvh lg:min-h-0" : ""
        } ${formFirst ? "lg:order-2" : "lg:order-1"}`}
        style={{ background: "linear-gradient(135deg, #1B6EF3, #1CB0F6)" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 size-[34rem] rounded-full bg-white/10"
        />

        {/* Same move as the landing footer's oversized wordmark: sized to fill
            its container's width rather than the viewport's, so all five letters
            land inside it. The panel is half the screen, hence ~12vw against the
            footer's 24vw. Sat in the bottom-right corner, and like the footer
            the tight leading lets the descender bleed off the bottom edge. */}
        <span
          aria-hidden="true"
          className="pointer-events-none relative block w-full select-none whitespace-nowrap pr-6 text-right font-rb-display text-[17vw] font-black lowercase leading-[0.72] tracking-tight text-white/25"
        >
          rebyu
        </span>
      </aside>
    </main>
  )
}
