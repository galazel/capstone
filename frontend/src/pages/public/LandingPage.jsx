import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  ChevronDown,
  FileQuestion,
  GraduationCap,
  Menu,
  MessageCircle,
  ShieldCheck,
  Users,
  X,

} from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeatureBento } from "./landing-feature-bento.jsx";
import { RoadmapSection } from "./landing-roadmap-section.jsx";
import { LANDING_IMAGES } from "./landing-images.js";

gsap.registerPlugin(ScrollTrigger);

const NAV_ITEMS = [
  { label: "About", href: "#about" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Certifications", href: "#certifications" },
  { label: "Features", href: "#features" },
  { label: "Team", href: "#team" },
  { label: "Get Access", href: "#get-access" },
];

const CERTIFICATIONS = [
  {
    title: "TOPCIT",
    type: "Certification review",
    description:
        "Prepare across software development, databases, networking, and information systems.",
    image: LANDING_IMAGES.certifications.topcit,
  },
  {
    title: "IT Passport",
    type: "Certification review",
    description:
        "Build a practical foundation in strategy, management, and technology topics.",
    image: LANDING_IMAGES.certifications.itPassport,
  },
  {
    title: "FE Exam",
    type: "Certification review",
    description:
        "Review computer science, algorithms, databases, networks, and core IT fundamentals for the Fundamental Information Technology Engineer Examination.",
    image: LANDING_IMAGES.certifications.feExam,
  },
];

const LEARNER_POINTS = [
  "Browse certifications and study lesson content",
  "Unlock analytics, weakness reports, and study plans",
  "Practice with mock exams and learner challenges",
  "Join certification discussions and study circles",
];

const ENTERPRISE_POINTS = [
  "Request a partnership and select certifications",
  "Configure learner slots and invite participants",
  "Assign certification access and track participation",
  "Receive consolidated institutional invoices",
];

const TEAM_MEMBERS = [
  {
    name: "Glyzel Galagar",
    role: "Founder & Backend Lead",
    description: "Product direction, Spring Boot services, platform architecture, and AI integration.",
    image: LANDING_IMAGES.team.founder,
    position: "object-[48%_38%]",
  },
  {
    name: "Frontend Team",
    role: "Frontend Development",
    description: "Learner interfaces, responsive experiences, assessments, and product interactions.",
    image: LANDING_IMAGES.team.frontend,
    position: "object-[46%_36%]",
  },
  {
    name: "Design Team",
    role: "UI/UX & Visual Design",
    description: "Research, interface systems, brand direction, and accessible learning experiences.",
    image: LANDING_IMAGES.team.design,
    position: "object-[54%_34%]",
  },
  {
    name: "Academic Team",
    role: "Content & Assessment",
    description: "Curriculum structure, reviewer quality, question design, and certification alignment.",
    image: LANDING_IMAGES.team.academic,
    position: "object-[52%_30%]",
  },
];

function BrandMark({ compact = false, textClassName = "text-foreground" }) {
  return (
      <span className="flex items-center gap-2.5">
      <span
          className={`flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ${
              compact ? "size-8" : "size-9"
          }`}
      >
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span className={`font-heading text-lg font-bold tracking-tight ${textClassName}`}>
        REBYU
      </span>
    </span>
  );
}

function LandingNavbar({ isScrolled }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const hasSolidBackground = mobileMenuOpen || isScrolled;
  const headerTextClassName = hasSolidBackground ? "text-[#102A43]" : "text-white";

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 1280px)");
    const closeAtDesktop = () => {
      if (desktopBreakpoint.matches) setMobileMenuOpen(false);
    };

    desktopBreakpoint.addEventListener("change", closeAtDesktop);
    return () => desktopBreakpoint.removeEventListener("change", closeAtDesktop);
  }, []);

  useLayoutEffect(() => {
    if (!mobileMenuOpen || !mobileMenuRef.current) return undefined;

    const context = gsap.context(() => {
      gsap.fromTo(
          mobileMenuRef.current,
          { height: 0, opacity: 0 },
          {
            height: "auto",
            opacity: 1,
            duration: 0.24,
            ease: "power2.out",
          },
      );
    }, mobileMenuRef);

    return () => context.revert();
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
        <div
            className={`pointer-events-auto w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
                hasSolidBackground
                    ? "border-[#D8E7F2] bg-white/95 shadow-[0_6px_22px_rgba(16,42,67,0.08)] backdrop-blur-xl"
                    : "border-transparent bg-transparent"
            }`}
        >
          <div className="relative mx-auto flex h-[68px] w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
            <Link
                to="/welcome"
                onClick={closeMobileMenu}
                className="relative z-10 flex origin-left items-center gap-2.5"
            >
              <BrandMark textClassName={headerTextClassName} />
            </Link>

            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 whitespace-nowrap xl:flex">
              {NAV_ITEMS.map((item) => (
                  <a
                      key={item.href}
                      href={item.href}
                      className={`relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform hover:after:scale-x-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          hasSolidBackground ? "text-[#53657A] hover:text-[#102A43]" : "text-white/80 hover:text-white"
                      }`}
                  >
                    {item.label}
                  </a>
              ))}
            </nav>

            <div className="relative z-10 hidden items-center gap-2.5 xl:flex">
              <Button
                  asChild
                  variant="ghost"
                  className={`${headerTextClassName} hover:bg-transparent hover:text-primary`}
              >
                <Link to="/login">Log in</Link>
              </Button>

              <Button
                  asChild
                  className="whitespace-nowrap px-5 shadow-none"
              >
                <Link to="/register">
                  Start preparing
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`relative z-10 ml-auto rounded-md ${headerTextClassName} hover:bg-white/15 hover:text-current xl:hidden`}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="landing-mobile-navigation"
                onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? (
                  <X className="size-5" aria-hidden="true" />
              ) : (
                  <Menu className="size-5" aria-hidden="true" />
              )}
            </Button>
          </div>

          {mobileMenuOpen ? (
              <div
                  ref={mobileMenuRef}
                  id="landing-mobile-navigation"
                  className="max-h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain border-t border-[#D9E3F2] bg-white xl:hidden"
              >
                <nav className="flex flex-col gap-1 p-4">
                  {NAV_ITEMS.map((item) => (
                      <a
                          key={item.href}
                          href={item.href}
                          onClick={closeMobileMenu}
                          className="rounded-md px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {item.label}
                      </a>
                  ))}
                </nav>

                <div className="grid grid-cols-2 gap-3 border-t border-[#D9E3F2] p-4">
                  <Button
                      asChild
                      variant="outline"
                      className="rounded-full border-[#C8D7F0] bg-white text-[#273452]"
                  >
                    <Link to="/login" onClick={closeMobileMenu}>
                      Log in
                    </Link>
                  </Button>

                  <Button
                      asChild
                      className="rounded-full bg-[#2F7DD3] text-white hover:bg-[#153FBE]"
                  >
                    <Link to="/register" onClick={closeMobileMenu}>
                      Get started
                    </Link>
                  </Button>
                </div>
              </div>
          ) : null}
        </div>
      </header>
  );
}

function HeroSection({ sectionRef, textRef }) {
  return (
      <section
          ref={sectionRef}
          className="relative min-h-[90vh] w-full overflow-hidden bg-[#102A43]"
      >
        <img
          src={LANDING_IMAGES.hero}
            alt="Learner preparing for a certification exam with a laptop"
            className="absolute inset-0 h-full w-full object-cover object-[64%_center] sm:object-[62%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07162D]/95 via-[#07162D]/68 to-[#07162D]/18" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07162D]/65 via-transparent to-[#07162D]/20" />

        <div
            className="relative z-10 mx-auto flex min-h-[90vh] w-full max-w-[1440px] flex-col justify-center px-5 pb-36 pt-28 sm:px-8 sm:pb-40 sm:pt-32 lg:px-12 lg:pb-44"
        >
            <div ref={textRef} className="relative w-full max-w-2xl text-left text-white">
              <p className="hero-kicker text-xs font-bold uppercase tracking-[0.16em] text-[#8DC7EF] sm:text-sm">
                AI-powered certification review
              </p>

              <h1 className="hero-title mt-5 max-w-2xl text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                Prepare smarter.
                <span className="block">Pass with confidence.</span>
              </h1>

              <p className="hero-copy mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
                Build exam readiness through diagnostic assessments, personalized study plans, structured lessons, mock exams, and focused weakness analysis.
              </p>

              <div className="hero-actions mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link to="/register">Start Learning<ArrowRight className="ml-2 size-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full border-white/55 bg-transparent text-white hover:border-white hover:bg-white/10 hover:text-white sm:w-auto">
                  <a href="#certifications">Explore Certifications</a>
                </Button>
              </div>

              <div className="hero-detail mt-7 flex items-center gap-2 text-sm text-white/70">
                <span className="size-2 rounded-full bg-[#D4A72C]" aria-hidden="true" />
                Lessons are free to access. Upgrade only when you need advanced preparation tools.
              </div>
            </div>
        </div>

        <div className="pointer-events-none absolute -bottom-[4.5vw] right-0 z-10 w-full select-none overflow-hidden text-right" aria-hidden="true">
          <p className="hero-word translate-x-[3vw] whitespace-nowrap pr-0 text-[clamp(9rem,29vw,30rem)] font-bold leading-[0.7] tracking-[-0.08em] text-white/[0.11]">
            REBYU
          </p>
        </div>
      </section>
  );
}

function AboutSection() {
  return (
      <section id="about" className="scroll-mt-24 bg-background px-5 py-24 sm:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-20">
          <figure
              data-landing-reveal
              className="relative min-h-[480px] overflow-hidden bg-[#E9EEF5] sm:rounded-[1.75rem]"
          >
            <img
                src={LANDING_IMAGES.assessmentOverview}
                alt="Learner completing a focused exam preparation session"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8DC7EF]">
                A clearer starting point
              </p>
              <p className="mt-3 max-w-md text-2xl font-bold leading-tight">
                Study time should follow evidence, not guesswork.
              </p>
            </div>
          </figure>

          <div data-landing-reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F7DD3]">
              About REBYU
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-[#273452] sm:text-5xl">
              Certification preparation should not feel scattered.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#61728A]">
              REBYU brings diagnostic assessments, structured lessons, quizzes,
              middle exams, mock exams, and progress insights into one connected
              learning experience.
            </p>

            <div className="mt-9 border-y border-[#E0E7EF]">
              {[
                ["01", "Start with a diagnostic", "Find weak topics before lessons begin."],
                ["02", "Study in the right order", "Follow a plan built from actual results."],
                ["03", "Practice at every level", "Complete lesson quizzes, middle exams, and mock exams."],
                ["04", "Track your readiness", "Use your results to decide what to study next."],
              ].map(([number, title, description]) => (
                  <div
                      key={number}
                      className="grid gap-3 border-b border-[#E0E7EF] py-5 last:border-b-0 sm:grid-cols-[56px_1fr]"
                  >
                <span className="text-xs font-bold tracking-[0.14em] text-[#2F7DD3]">
                  {number}
                </span>
                    <div>
                      <h3 className="text-base font-bold text-[#273452]">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#66758A]">
                        {description}
                      </p>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
      </section>
  );
}

function CertificationSection() {
  return (
      <section
          id="certifications"
          className="border-y border-[#E0E7EF] bg-[#F7F9FC] px-5 py-24 sm:py-28 lg:px-8 lg:py-36"
      >
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F7DD3]">
              Certification reviewers
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-[#273452] sm:text-5xl">
              Choose the review path that matches your goal.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {CERTIFICATIONS.map((certification) => (
                <article
                    key={certification.title}
                    data-landing-reveal
                    className="group overflow-hidden border border-[#E0E7EF] bg-white"
                >
                  <div className="relative h-60 overflow-hidden">
                    <img
                        src={certification.image}
                        alt="Learners preparing for certification examinations"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/66 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-4 rounded-md bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#273452] shadow-sm">
                  {certification.type}
                </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-[#273452]">
                      {certification.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#66758A]">
                      {certification.description}
                    </p>
                  </div>
                </article>
            ))}
          </div>
        </div>
      </section>
  );
}

function CommunitySection() {
  return (
      <section id="community" className="scroll-mt-24 bg-[#273452] px-5 py-24 text-white sm:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-[4.5rem]">
          <figure
              data-landing-reveal
              className="relative min-h-[500px] overflow-hidden bg-[#102A43] sm:rounded-[1.75rem]"
          >
            <img
                src={LANDING_IMAGES.community}
                alt="College students studying together in a classroom"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/78 via-[#102A43]/10 to-transparent" />
            <figcaption className="absolute bottom-4 left-5 text-xs text-white/90">
              Photo by Yan Krukau on Pexels
            </figcaption>
          </figure>

          <div data-landing-reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8DC7EF]">
              Community and study circles
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
              Prepare with learners working toward the same certification.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#E0E7EF]">
              Ask certification-related questions, share study resources, and join
              focused discussions with learners preparing for the same goal.
            </p>

            <div className="mt-8 space-y-3">
              <div className="border border-white/[0.14] bg-white/[0.06] p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#8DC7EF]">
                  <Users className="size-4" aria-hidden="true" />
                  TOPCIT study circle
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white">
                  “Software Development review tonight. We will compare Agile and
                  Waterfall before taking the quiz.”
                </p>
                <p className="mt-3 text-xs font-medium text-[#D3DFEA]">8 learners joined</p>
              </div>
              <div className="border border-white/[0.14] bg-white/[0.06] p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#8DC7EF]">
                  <FileQuestion className="size-4" aria-hidden="true" />
                  Shared quiz
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white">
                  “I created a 15-item practice quiz for Database Normalization.”
                </p>
                <p className="mt-3 text-xs font-medium text-[#D3DFEA]">12 attempts · 4 replies</p>
              </div>
              <div className="flex items-center gap-3 pt-3 text-sm font-semibold text-[#8DC7EF]">
                <MessageCircle className="size-4" aria-hidden="true" />
                Discussions stay connected to certifications and lessons.
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}

function TeamMemberCard({ member }) {
  return (
      <article
          data-team-card
          className="group relative min-h-[420px] overflow-hidden rounded-[0.85rem] bg-[#DDE4EC] sm:min-h-[470px] lg:min-h-[500px]"
      >
        <img
            src={member.image}
            alt={`${member.name} — ${member.role}`}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035] ${member.position}`}
            loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#07162D] via-[#102A43]/30 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
          <h3 className="text-xl font-bold tracking-[-0.025em] text-white drop-shadow-sm sm:text-2xl">
            {member.name}
          </h3>
          <p className="mt-2 text-sm font-medium text-[#B9D9F0]">
            {member.role}
          </p>
        </div>
      </article>
  );
}

function TeamSection() {
  return (
      <section
          id="team"
          className="scroll-mt-24 bg-white px-5 py-24 sm:py-28 lg:px-8 lg:py-36"
      >
        <div className="mx-auto max-w-7xl">
          <div
              data-landing-reveal
              className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-4xl font-bold tracking-[-0.045em] text-[#273452] sm:text-5xl">
              Team
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#66758A] sm:text-base">
              REBYU is built by a multidisciplinary team focused on making
              certification preparation clearer, more structured, and easier
              for learners to follow.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
            {TEAM_MEMBERS.map((member) => (
                <TeamMemberCard
                    key={member.name}
                    member={member}
                />
            ))}
          </div>
        </div>
      </section>
  );
}

function AccessColumn({ icon: Icon, title, description, points, button, to, dark }) {
  return (
      <div className={`flex h-full flex-col p-7 sm:p-9 ${dark ? "bg-[#273452] text-white" : "bg-white"}`}>
      <span
          className={`flex size-11 items-center justify-center rounded-xl ${
              dark ? "bg-white text-[#273452]" : "bg-[#E8F3FC] text-[#2F7DD3]"
          }`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
        <h3 className={`mt-6 text-2xl font-bold ${dark ? "text-white" : "text-[#273452]"}`}>
          {title}
        </h3>
        <p className={`mt-3 text-sm leading-6 md:min-h-[4.5rem] lg:min-h-24 ${dark ? "text-[#E0E7EF]" : "text-[#66758A]"}`}>
          {description}
        </p>
        <div className={`mt-7 flex-1 space-y-3 border-y py-6 ${dark ? "border-white/[0.14]" : "border-[#E0E7EF]"}`}>
          {points.map((point) => (
              <div key={point} className="flex items-start gap-3 text-sm">
                <Check
                    className={`mt-0.5 size-4 shrink-0 ${dark ? "text-[#8DC7EF]" : "text-[#2F7DD3]"}`}
                    aria-hidden="true"
                />
                <span className={dark ? "text-[#E0E7EF]" : "text-[#465A76]"}>
              {point}
            </span>
              </div>
          ))}
        </div>
        <Button
            asChild
            className={`mt-7 w-full rounded-lg ${
                dark
                    ? "bg-white text-[#273452] hover:bg-[#E9EEF5]"
                    : "bg-[#2F7DD3] text-white hover:bg-[#1F5F99]"
            }`}
        >
          <Link to={to}>
            {button}
            <ArrowRight className="ml-2 size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
  );
}

function AccessSection() {
  return (
      <section id="get-access" className="scroll-mt-24 bg-muted/40 px-5 py-24 sm:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[0.84fr_1.16fr]">
            <figure className="relative min-h-[400px] overflow-hidden bg-muted sm:min-h-[480px] lg:min-h-[560px]">
              <img
                  src={LANDING_IMAGES.institution}
                  alt="Teacher guiding learners in a computer laboratory"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/72 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8DC7EF]">
                  Individual and institutional access
                </p>
                <p className="mt-3 max-w-md text-3xl font-bold leading-tight">
                  One platform for self-directed learners and partner institutions.
                </p>
                <p className="mt-4 text-xs text-white/90">
                  Photo by Gustavo Fring on Pexels
                </p>
              </div>
            </figure>

            <div className="grid items-stretch border-t border-border md:grid-cols-2 md:border-t-0 lg:border-l">
              <AccessColumn
                  icon={GraduationCap}
                  title="For learners"
                  description="Explore available certifications, study structured lessons, and unlock advanced preparation tools with a premium plan."
                  points={LEARNER_POINTS}
                  button="Start Reviewing"
                  to="/register"
              />
              <AccessColumn
                  icon={Building2}
                  title="For institutions"
                  description="Provide certification access to learners through a managed partnership workflow."
                  points={ENTERPRISE_POINTS}
                  button="Request Partnership"
                  to="/enterprise/request-access"
                  dark
              />
            </div>
          </div>
        </div>
      </section>
  );
}

function Footer() {
  return (
      <footer className="relative overflow-hidden bg-gradient-to-b from-[#273452] to-[#040E1E] px-5 pt-24 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">

          {/* Top Grid - Columns like Discord */}
          <div className="grid gap-16 lg:grid-cols-[1.5fr_2fr]">
            {/* Left Column: Brand & Language/Social */}
            <div className="flex flex-col gap-8">
              {/* Language Selector */}
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                  Language
                </div>
                <button className="flex w-36 items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10">
                  English
                  <ChevronDown className="size-4" />
                </button>
              </div>

              {/* Socials */}
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                  Social
                </div>
                <div className="flex items-center gap-5">
                  <a href="#" aria-label="Twitter" className="text-[#8DC7EF] transition-colors hover:text-white">fdsaf</a>
                  <a href="#" aria-label="Instagram" className="text-[#8DC7EF] transition-colors hover:text-white">fsdaf</a>
                  <a href="#" aria-label="Facebook" className="text-[#8DC7EF] transition-colors hover:text-white">fasdf</a>
                  <a href="#" aria-label="YouTube" className="text-[#8DC7EF] transition-colors hover:text-white">fasdf</a>
                </div>
              </div>
            </div>

            {/* Right Column: Link Groups */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {[
                {
                  title: "Platform",
                  links: [
                    ["Certifications", "#certifications"],
                    ["Features", "#features"],
                    ["How It Works", "#how-it-works"],
                  ],
                },
                {
                  title: "Access",
                  links: [
                    ["Learner Login", "/login"],
                    ["Create Account", "/register"],
                    ["Institution Access", "/enterprise/request-access"],
                  ],
                },
                {
                  title: "Discover",
                  links: [
                    ["About", "#about"],
                    ["Community", "#community"],
                    ["Team", "#team"],
                  ],
                },
                {
                  title: "Legal",
                  links: [
                    ["Terms of Use", "/terms"],
                    ["Privacy Policy", "/privacy"],
                    ["Guidelines", "/guidelines"],
                  ],
                },
              ].map((column) => (
                  <div key={column.title}>
                    <h3 className="text-sm font-bold text-white">{column.title}</h3>
                    <div className="mt-5 flex flex-col gap-4">
                      {column.links.map(([label, to]) => (
                          <a
                              key={to}
                              href={to}
                              className="text-sm text-[#8DC7EF] transition-colors hover:text-white hover:underline underline-offset-2"
                          >
                            {label}
                          </a>
                      ))}
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* Huge Logo Text - Discord Style (Subtle) */}
        <div className="pointer-events-none mt-14 flex w-full select-none justify-center overflow-hidden leading-[0.75]">
          <span className="text-[25vw] font-black tracking-[-0.04em] text-[#102A43]">
            REBYU
          </span>
        </div>
      </footer>
  );
}

export default function LandingPage() {
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const heroTextRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateHeaderState = () => setIsScrolled(window.scrollY > 48);
    updateHeaderState();
    window.addEventListener("scroll", updateHeaderState, { passive: true });

    return () => window.removeEventListener("scroll", updateHeaderState);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set("[data-landing-reveal]", { opacity: 1, y: 0 });
        gsap.set("[data-team-card]", {
          opacity: 1,
          y: 0,
          clipPath: "inset(0 0 0% 0)",
        });
        return;
      }

      const heroTimeline = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      heroTimeline
          .from(".hero-kicker", { opacity: 0, y: 12, duration: 0.4, delay: 0.12 })
          .from(".hero-title", { opacity: 0, y: 28, duration: 0.68 }, "-=0.2")
          .from(".hero-copy", { opacity: 0, y: 16, duration: 0.5 }, "-=0.38")
          .from(".hero-actions", { opacity: 0, y: 14, duration: 0.45 }, "-=0.3")
          .from(".hero-detail", { opacity: 0, y: 10, duration: 0.4 }, "-=0.25")
          .from(".hero-word", { opacity: 0, y: 24, duration: 0.7 }, "-=0.45");

      gsap.to(heroTextRef.current, {
        yPercent: -5,
        opacity: 0.84,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });

      gsap.utils.toArray("[data-landing-reveal]", root).forEach((element) => {
        gsap.fromTo(
            element,
            { opacity: 0, y: 34 },
            {
              opacity: 1,
              y: 0,
              duration: 0.75,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 82%",
                once: true,
              },
            },
        );
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
      <div
          ref={rootRef}
          className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/20 selection:text-foreground"
      >
        <LandingNavbar isScrolled={isScrolled} />
        <main>
          <HeroSection
              sectionRef={heroRef}
              textRef={heroTextRef}
          />
          <AboutSection />
          <RoadmapSection />
          <FeatureBento />
          <CertificationSection />
          <CommunitySection />
          <TeamSection />
          <AccessSection />
        </main>
        <Footer />
      </div>
  );
}
