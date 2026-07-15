import { ArrowLeft, Check } from "lucide-react"
import { Link } from "react-router-dom"

import { BrandLogo } from "@/components/brand-logo"
import { LANDING_IMAGES } from "@/pages/public/landing-images.js"

const BENEFITS = [
  "Find weak topics before you begin",
  "Follow a study plan shaped by your progress",
  "Build confidence through structured practice",
]

export default function AuthShell({ title, description, children, footer, compact = false }) {
  return (
    <main className={`public-auth-shell min-h-dvh bg-white text-[#273452] lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)] ${compact ? "lg:h-dvh lg:overflow-hidden" : ""}`}>
      <section className={`relative flex min-h-dvh flex-col px-5 sm:px-8 lg:px-12 xl:px-16 ${compact ? "py-4 sm:py-5 lg:h-dvh lg:min-h-0" : "py-5 sm:py-7"}`}>
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5A9DDD]"
          >
            <BrandLogo className="size-9" />
            <span className="font-heading text-xl font-bold tracking-[-0.025em]">REBYU</span>
          </Link>

          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#66758A] transition-colors hover:text-[#2F7DD3]">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>
        </div>

        <div className={`mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center ${compact ? "py-5 sm:py-6" : "py-12 sm:py-16"}`}>
          <div className={`border-b border-[#E0E7EF] ${compact ? "mb-5 pb-4" : "mb-8 pb-7"}`}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2F7DD3]">
              Certification preparation
            </p>
            <h1 className={`mt-3 font-heading font-bold leading-tight tracking-[-0.035em] text-[#273452] ${compact ? "text-3xl" : "text-3xl sm:text-4xl"}`}>
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-md text-[15px] leading-7 text-[#66758A]">{description}</p>
            ) : null}
          </div>

          {children}

          {footer ? (
            <div className={`border-t border-[#E0E7EF] text-center text-sm text-[#66758A] ${compact ? "mt-4 pt-4" : "mt-7 pt-6"}`}>
              {footer}
            </div>
          ) : null}
        </div>

        <p className="text-xs text-[#8795A8]">© {new Date().getFullYear()} REBYU</p>
      </section>

      <aside className={`relative hidden min-h-dvh overflow-hidden bg-[#102A43] lg:block ${compact ? "lg:h-dvh lg:min-h-0" : ""}`}>
        <img
          src={LANDING_IMAGES.hero}
          alt="Learner preparing for a certification exam"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07162D]/95 via-[#102A43]/62 to-[#07162D]/18" />
        <div className="relative flex min-h-dvh flex-col justify-end p-12 text-white xl:p-16">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#8DC7EF]">
            One connected review experience
          </p>
          <h2 className="mt-4 max-w-xl font-heading text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-white xl:text-5xl">
            Prepare with clarity. Walk into the exam confident.
          </h2>
          <div className="mt-8 grid max-w-xl gap-3 border-t border-white/20 pt-7">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm text-white/85">
                <Check className="size-4 shrink-0 text-[#D4A72C]" aria-hidden="true" />
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  )
}
