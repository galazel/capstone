import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  Brain,
  Briefcase,
  Building2,
  Check,
  Code2,
  Cpu,
  FileText,
  Gift,
  Gauge,
  GraduationCap,
  Heart,
  Layers,
  Lock,
  Menu,
  MessageCircle,
  Network,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "@/components/icons";

import { BrandLogo } from "@/components/brand-logo";
import { Chip, ProgressBar, RebyuCard, TactileButton } from "@/components/rebyu/rebyu-ui.jsx";
import {
  DomainMasteryChart,
  MasteryChart,
  RetentionChart,
} from "./landing-charts.jsx";

const NAV_ITEMS = [
  { label: "about", href: "#about" },
  { label: "the problem", href: "#problem" },
  { label: "how it works", href: "#how-it-works" },
  { label: "certifications", href: "#certifications" },
  { label: "arenas", href: "#roadmap" },
  { label: "ai tutor", href: "#ai-tutor" },
  { label: "community", href: "#community" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "take the diagnostic",
    body: "A short placement test maps what you already know across every exam domain.",
    tone: "macaw",
  },
  {
    step: "02",
    title: "get your plan",
    body: "Rebyu orders your lessons by what is weakest and what the exam weighs most.",
    tone: "beetle",
  },
  {
    step: "03",
    title: "study in short sets",
    body: "Ten-minute lessons, instant feedback on every answer, flashcards on what you miss.",
    tone: "feather",
  },
  {
    step: "04",
    title: "sit a mock exam",
    body: "Full-length, timed, scored against the real passing mark before you book the date.",
    tone: "fox",
  },
];

/* `wordmark` is set oversized and clipped inside the card header — it does the
   work a photo used to, without the stock-image feel. */
const CERTIFICATIONS = [
  {
    title: "TOPCIT",
    wordmark: "topcit",
    tone: "macaw",
    icon: Code2,
    summary:
      "The Test of Practical Competency in IT. Weighted toward applied software work rather than recall.",
    lessons: 96,
    questions: "1,240",
    topics: [
      "Software development",
      "Databases",
      "Networking",
      "Information systems",
      "Project management",
    ],
  },
  {
    title: "IT Passport",
    wordmark: "passport",
    tone: "bee",
    icon: Briefcase,
    summary:
      "Japan's entry-level national IT qualification. Broad coverage, lighter depth — the usual first certificate.",
    lessons: 64,
    questions: "980",
    topics: ["Strategy", "Management", "Technology"],
  },
  {
    title: "FE Exam",
    wordmark: "fe",
    tone: "beetle",
    icon: Cpu,
    summary:
      "Fundamental Information Technology Engineer. The deepest of the three, and the most computer-science heavy.",
    lessons: 148,
    questions: "1,860",
    topics: [
      "Computer science",
      "Algorithms",
      "Databases",
      "Networks",
      "Security",
      "Software engineering",
      "System architecture",
      "Project management",
      "IT strategy",
    ],
  },
];

/* IT Olympics — two solo endurance modes plus the synchronised 8-player
   tournament. `format` is the honest distinction between them, and it is what
   the card leads with: solo runs can be started any time, the World Cup needs
   seven other people.

   `accent` and `surfaceClass` are the same pairings the in-product challenge
   hub uses for each arena, so an arena is the same colour to a visitor as it is
   to a signed-in learner. */
const OLYMPICS_MODES = [
  {
    id: "codestrike",
    name: "codestrike",
    role: "Coding Skills",
    tag: "Practice",
    format: "solo · 10 problems",
    icon: Code2,
    accent: "linear-gradient(135deg, #1B6EF3, #1CB0F6)",
    surfaceClass: "bg-rb-macaw-wash",
    blurb:
      "Ten coding problems back to back, judged against real unit tests as you type and scored on time complexity.",
    points: ["Live judge with split-screen tests", "Scored on Big-O efficiency", "Global and tier ranking"],
    to: "/learner/challenges/codestrike",
  },
  {
    id: "blueprint",
    name: "blueprint arena",
    role: "Design Skills",
    tag: "Design",
    format: "solo · 10 problems",
    icon: Network,
    accent: "linear-gradient(135deg, #B061E6, #CE82FF)",
    surfaceClass: "bg-rb-beetle-wash",
    blurb:
      "Ten UML and system design problems on a drag-and-drop canvas, checked against structural rules rather than opinion.",
    points: ["Pre-loaded architecture components", "Structural validation, not opinion", "Accuracy score and rank tier"],
    to: "/learner/challenges/blueprint-arena",
  },
  {
    id: "worldcup",
    name: "world cup",
    role: "Exam Readiness",
    tag: "Tournament",
    format: "8 players · live bracket",
    icon: Trophy,
    accent: "linear-gradient(135deg, #E08600, #FF9600)",
    surfaceClass: "bg-rb-fox-wash",
    blurb:
      "Queue into an eight-player lobby on your track and fight through quarterfinals, semis, and a grand final.",
    points: ["Track-locked matchmaking", "Timed 1v1 bracket rounds", "MVP and match awards"],
    to: "/learner/challenges/world-cup",
  },
];

/** Wraps the index so the carousel is a ring, not a strip with two dead ends. */
function olympicsOffset(index, activeIndex) {
  let difference = index - activeIndex;
  const midpoint = Math.floor(OLYMPICS_MODES.length / 2);
  if (difference > midpoint) difference -= OLYMPICS_MODES.length;
  if (difference < -midpoint) difference += OLYMPICS_MODES.length;
  return difference;
}

/* Priority is derived, not chosen: it ranks how weak the learner is against how
   heavily the exam weights that domain. Shared by the roadmap path and the
   module list so one concept never wears two different looks. Labels stay plain
   words — a learner should never have to decode a badge. */
const PRIORITY = {
  high: { label: "high priority", chip: "bg-rb-cardinal-wash text-rb-cardinal-lip", bar: "cardinal" },
  medium: { label: "worth a look", chip: "bg-rb-fox-wash text-rb-fox-lip", bar: "fox" },
  low: { label: "low priority", chip: "bg-rb-polar text-rb-wolf", bar: "mask" },
  done: { label: "mastered", chip: "bg-rb-feather-wash text-rb-feather-ink", bar: "feather" },
};

const LEARNER_POINTS = [
  "Browse certifications and study every lesson free",
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

/* Community is a feed, not a group chat: learners post practice sets, notes and
   files that other learners can open, attempt, and save. */
const FEED_POSTS = [
  {
    author: "Rina Delgado",
    initials: "rd",
    avatar: "bg-rb-beetle-wash text-rb-beetle-lip",
    tag: "TOPCIT · Databases",
    when: "2h",
    kind: "practice set",
    kindChip: "bg-rb-macaw-wash text-rb-macaw-lip",
    text: "Built a 15-item set on normalization — 1NF through BCNF, with explanations on every answer.",
    attachIcon: Layers,
    attachTone: "bg-rb-macaw-wash text-rb-macaw-lip",
    attachName: "Normalization drill",
    attachMeta: "15 questions · 12 attempts",
    attachAction: "attempt",
    likes: 34,
    comments: 8,
  },
  {
    author: "Jed Ramos",
    initials: "jr",
    avatar: "bg-rb-fox-wash text-rb-fox-lip",
    tag: "FE Exam · Networks",
    when: "5h",
    kind: "material",
    kindChip: "bg-rb-bee-wash text-rb-bee-ink",
    text: "My subnetting cheat sheet from last week's review. The CIDR table on page 2 is the useful bit.",
    attachIcon: FileText,
    attachTone: "bg-rb-cardinal-wash text-rb-cardinal-lip",
    attachName: "subnetting-cheatsheet.pdf",
    attachMeta: "PDF · 1.2 MB · 96 downloads",
    attachAction: "open",
    likes: 61,
    comments: 14,
  },
];

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandLogo className="size-9" />
      <span className="rb-display text-2xl leading-none">rebyu</span>
    </span>
  );
}

/* ---------------------------------------------------------------- navigation */

function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const close = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className={`w-full border-b-2 bg-rb-snow transition-colors duration-200 ${
          isScrolled || mobileMenuOpen ? "border-rb-swan" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between gap-6 px-5 lg:px-8">
          <Link to="/welcome" onClick={close} className="shrink-0">
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-rb-pill px-4 py-2 font-rb-display text-[0.9375rem] font-extrabold text-rb-wolf transition-colors hover:bg-rb-polar hover:text-rb-eel focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <TactileButton asChild variant="ghost" size="sm">
              <Link to="/login">log in</Link>
            </TactileButton>
            <TactileButton asChild size="sm">
              <Link to="/register">start learning</Link>
            </TactileButton>
          </div>

          <button
            type="button"
            className="grid size-11 place-items-center rounded-rb-tile text-rb-eel transition-colors hover:bg-rb-polar focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div
            id="landing-mobile-navigation"
            className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t-2 border-rb-swan bg-rb-snow p-5 lg:hidden"
          >
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="rounded-rb-tile px-4 py-3.5 font-rb-display text-lg font-extrabold text-rb-eel transition-colors hover:bg-rb-polar"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-3">
              <TactileButton asChild>
                <Link to="/register" onClick={close}>
                  start learning
                </Link>
              </TactileButton>
              <TactileButton asChild variant="ghost">
                <Link to="/login" onClick={close}>
                  log in
                </Link>
              </TactileButton>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

/* --------------------------------------------------- hero assessment gallery */

/**
 * The hero visual: photographs of the assessment workspace.
 *
 * These are screenshots of the real attempt page, not a drawing of it — shot
 * from `/__preview/attempt` by `scripts/shoot-attempt-screenshots.mjs`, which
 * renders the genuine `LearnerAssessmentAttemptPage` against fixture answers.
 * The hero is the one block on the site that claims what sitting an exam looks
 * like, so it should not be able to drift from the product. Re-run that script
 * rather than editing anything here when the attempt page changes.
 *
 * No type label is drawn over the frame. Every shot has real UI in every corner
 * — the exam header, the navigator, the problem column — so any overlay covers
 * something the screenshot exists to show, and each shot already names its own
 * type in the item's own badge. `label` survives for the dot controls' accessible
 * names.
 */
const WORKSPACE_SHOTS = [
  {
    id: "mcq",
    label: "Multiple Choice",
    src: "/screenshots/attempt-multiple-choice.png",
    alt: "The Rebyu attempt page on a multiple choice item: the question and four tactile options in the centre, item navigation on the right showing which items are answered and flagged, and the exam clock in the header.",
  },
  {
    id: "short-answer",
    label: "Short Answer",
    src: "/screenshots/attempt-short-answer.png",
    alt: "The attempt page on a short answer item: a single typed answer field beneath the question, with the same item navigation and clock.",
  },
  {
    id: "descriptive",
    label: "Descriptive",
    src: "/screenshots/attempt-descriptive.png",
    alt: "The attempt page on a descriptive item: a long written answer in progress with a live character count, marked against a rubric.",
  },
  {
    id: "programming",
    label: "Programming",
    src: "/screenshots/attempt-programming.png",
    alt: "The attempt page on a programming item: three columns — the problem, its constraints and its parts on the left, a syntax-highlighted code editor with Run and Check in the centre, and item navigation over the test cases on the right.",
  },
  {
    id: "diagram",
    label: "Diagram",
    src: "/screenshots/attempt-diagram.png",
    alt: "The attempt page on a diagram item: an entity relationship diagram part-built on the canvas, with the problem on the left and the scoring rubric beside item navigation on the right.",
  },
]

/* 16:10, the aspect the screenshots are shot at. Reserved with `aspect-*` so
   the fold does not jump as each image decodes. */
function AssessmentGallery() {
  const [index, setIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useEffect(() => {
    if (reducedMotion) return undefined
    const timer = window.setTimeout(
      () => setIndex((n) => (n + 1) % WORKSPACE_SHOTS.length),
      5600
    )
    return () => window.clearTimeout(timer)
  }, [index, reducedMotion])

  return (
    <figure className="relative mx-auto w-full">
      <div className="relative overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_6px_0_var(--color-rb-swan)]">
        <div className="relative aspect-[16/10] w-full">
          {/* All five stay mounted and cross-fade: swapping one <img> src
              flashes the frame empty for a beat on every cycle. */}
          {WORKSPACE_SHOTS.map((shot, shotIndex) => (
            <img
              key={shot.id}
              src={shot.src}
              alt={shot.alt}
              width={2880}
              height={1800}
              loading={shotIndex === 0 ? "eager" : "lazy"}
              decoding="async"
              className={
                "absolute inset-0 size-full object-cover object-top transition-opacity duration-500 " +
                (shotIndex === index ? "opacity-100" : "opacity-0")
              }
            />
          ))}
        </div>

      </div>

      {/* Position sits under the frame, where a carousel's controls are looked
          for. The type itself is not named — each shot says what it is. */}
      <div className="mt-5 flex justify-center gap-2">
        {WORKSPACE_SHOTS.map((shot, shotIndex) => (
          <button
            key={shot.id}
            type="button"
            onClick={() => setIndex(shotIndex)}
            aria-label={`Show the ${shot.label} question type`}
            aria-current={shotIndex === index ? "true" : undefined}
            className={
              "h-2.5 rounded-rb-pill transition-all " +
              (shotIndex === index
                ? "w-8 bg-rb-eel"
                : "w-2.5 bg-rb-swan hover:bg-rb-hare")
            }
          />
        ))}
      </div>

      <figcaption className="mt-4 text-center text-sm font-semibold text-rb-wolf">
        One workspace, five question types — multiple choice through code and
        diagrams. These are screenshots of the real thing.
      </figcaption>
    </figure>
  )
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-rb-snow">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-52 hidden size-[720px] rounded-full bg-rb-feather-wash lg:block"
      />

      <div className="relative mx-auto w-full max-w-[1280px] px-5 pb-12 pt-16 lg:px-8 lg:pb-14 lg:pt-20">
        {/* Centred: the hero is the one block on the site with nothing beside
            it, and the workspace demo below it is centred too — left-aligning
            the copy over a centred visual pulled the whole fold off axis.
            `!text-center` because `.rb-display` sets left alignment as a system
            rule, and an unlayered rule outranks a Tailwind utility. */}
        {/* 4xl, not 3xl: at the display-xl size "study what you don't know."
            is ~830px, so a 768px block broke it after "don't" and the heading
            came out three lines. The width is set by the heading; the paragraph
            keeps its own narrower measure. */}
        <div className="mx-auto max-w-4xl text-center">
          <Chip tone="feather">
            <Sparkles className="size-4" />
            topcit · it passport · fe exam
          </Chip>

          <h1 className="rb-display rb-display-xl mt-6 !text-center">
            study what you don't know.
            <br />
            skip what you do.
          </h1>

          <p className="rb-body-lg mx-auto mt-6 max-w-xl">
            Rebyu measures your mastery of every topic as you answer, then puts the weakest ones in
            front of you first. No more re-reading what you already know, and no more finding out
            what you missed on exam day.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <TactileButton asChild size="lg">
              <Link to="/register">
                start learning
                <ArrowRight className="size-5" />
              </Link>
            </TactileButton>
            <TactileButton asChild size="lg" variant="ghost">
              <a href="#certifications">see what's covered</a>
            </TactileButton>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-rb-wolf">
            <span className="size-2 rounded-full bg-rb-mask" aria-hidden="true" />
            Every lesson is free. Upgrade only for mock exams and analytics.
          </p>
        </div>

      </div>

      {/* Wider than the copy above it, and outside that container to get there:
          the screenshots are dense product UI, and at the text column's measure
          the code editor and the item navigator stop being legible. */}
      <div className="relative mx-auto w-full max-w-[1560px] px-5 pb-16 lg:px-8 lg:pb-20">
        <AssessmentGallery />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- what it is */

function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24 bg-rb-snow px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal className="max-w-3xl">
          <p className="rb-eyebrow">what rebyu is</p>
          <h2 className="rb-display rb-display-lg mt-3">
            one place to prepare for one exam.
          </h2>
          <p className="rb-body-lg mt-5">
            Rebyu is a certification review platform for TOPCIT, IT Passport, and the FE exam. It
            holds the whole preparation cycle — a diagnostic that finds your gaps, lessons ordered
            around them, real assessments with code and diagram work, timed mock exams, and a
            mastery level per topic you can actually act on.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Layers, "Structured curriculum", "Ten units per certification, unlocked in order."],
            [Code2, "Real assessments", "Write code against test cases, build diagrams on a canvas."],
            [BarChart3, "Mastery tracking", "Every answer updates a per-topic estimate."],
            [Users, "Built for both", "Study on your own, or through your institution."],
          ].map(([Icon, title, body]) => (
            <RebyuCard key={title} raised data-landing-reveal>
              <span className="grid size-12 place-items-center rounded-2xl bg-rb-feather-wash text-rb-feather-ink">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="rb-display rb-display-sm mt-4">{title}</h3>
              <p className="rb-body mt-2 text-[0.9375rem]">{body}</p>
            </RebyuCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- problem */

function ProblemSection() {
  return (
    <section id="problem" className="scroll-mt-24 bg-rb-polar px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div data-landing-reveal>
          <p className="rb-eyebrow">the problem</p>
          <h2 className="rb-display rb-display-lg mt-3">
            cramming feels productive. it isn't.
          </h2>
          <p className="rb-body-lg mt-5">
            Most people prepare by reading everything once, a few weeks before the date. A month
            later almost none of it is left — and there was never a signal telling them which parts
            had already gone.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              ["Material is scattered", "PDFs, videos, and past papers with nothing connecting them."],
              ["No feedback loop", "You find out what you did not know on exam day."],
              ["Effort goes to the wrong place", "Time is spent on comfortable topics, not weak ones."],
              ["Weak spots stay hidden", "Nothing tells you which topics are actually weak."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-rb-cardinal-wash">
                  <X className="size-3.5 text-rb-cardinal-lip" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-bold text-rb-eel">{title}</div>
                  <p className="rb-body text-[0.9375rem]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <RebyuCard raised data-landing-reveal>
          <p className="rb-eyebrow">Retention after one study session</p>
          <h3 className="rb-display rb-display-sm mt-2">
            what you keep, 30 days later
          </h3>
          <div className="mt-5">
            <RetentionChart />
          </div>
          <p className="rb-body mt-4 text-sm">
            Crammed material decays to roughly a seventh of what you started with. Reviewed on a
            schedule, it holds.
          </p>
        </RebyuCard>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- solution */

function SolutionSection() {
  return (
    <section id="solution" className="scroll-mt-24 bg-rb-snow px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Chart left, copy right. The card already leads in source order, so
            the columns fall this way on their own -- the order utilities that
            used to flip them back were the only thing putting it on the right. */}
        <RebyuCard raised data-landing-reveal>
          <p className="rb-eyebrow">Mastery per domain</p>
          <h3 className="rb-display rb-display-sm mt-2">six weeks of tracked study</h3>
          <div className="mt-5">
            <MasteryChart />
          </div>
          <p className="rb-body mt-4 text-sm">
            Every answer updates the estimate. Databases is still the weakest domain, so it stays at
            the top of the study plan.
          </p>
        </RebyuCard>

        <div data-landing-reveal>
          <p className="rb-eyebrow">the solution</p>
          <h2 className="rb-display rb-display-lg mt-3">
            measure what you know. study what you don't.
          </h2>
          <p className="rb-body-lg mt-5">
            Rebyu turns preparation into a loop: answer, get corrected immediately, and let the
            result change what you see next. Nothing is left to memory or willpower.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              [Layers, "Everything in one track", "Lessons, quizzes, code tasks, diagrams, and mock exams under one curriculum."],
              [Zap, "Feedback on every answer", "Right or wrong is shown instantly, with the correction attached."],
              [Target, "Effort follows the data", "Modules are ranked by mastery against exam weight."],
              [BarChart3, "Mastery is measured", "A level per topic, with a confidence showing how sure it is."],
            ].map(([Icon, title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-rb-feather-wash">
                  <Icon className="size-3.5 text-rb-feather-ink" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-bold text-rb-eel">{title}</div>
                  <p className="rb-body text-[0.9375rem]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- how it works */

function HowItWorksSection() {
  const TONE_CLASSES = {
    macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
    beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
    feather: "bg-rb-feather-wash text-rb-feather-ink",
    fox: "bg-rb-fox-wash text-rb-fox-lip",
  };

  return (
    <section id="how-it-works" className="scroll-mt-24 bg-rb-polar px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal>
          <p className="rb-eyebrow">how it works</p>
          <h2 className="rb-display rb-display-lg mt-3 max-w-2xl">
            four steps, in this order, every time.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <RebyuCard key={item.step} raised data-landing-reveal className="flex flex-col">
              <span
                className={`grid size-12 place-items-center rounded-2xl font-rb-display text-base font-extrabold ${
                  TONE_CLASSES[item.tone]
                }`}
              >
                {item.step}
              </span>
              <h3 className="rb-display rb-display-sm mt-5">{item.title}</h3>
              <p className="rb-body mt-2 text-[0.9375rem]">{item.body}</p>
            </RebyuCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- certifications */

function CertificationSection() {
  /* A showcase, not a comparison: full-width bands that put each certification's
     actual topic list on the page. What a reader wants here is "what is in the
     system", and that is the topics — not a spec sheet of exam trivia. */
  const TONE = {
    macaw: { face: "bg-rb-macaw", chip: "bg-rb-macaw-wash text-rb-macaw-lip", btn: "macaw" },
    bee: { face: "bg-rb-bee", chip: "bg-rb-bee-wash text-rb-bee-ink", btn: "fox" },
    beetle: { face: "bg-rb-beetle", chip: "bg-rb-beetle-wash text-rb-beetle-lip", btn: "beetle" },
  };

  return (
    <section id="certifications" className="scroll-mt-24 bg-rb-snow px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal>
          <p className="rb-eyebrow">certifications</p>
          <h2 className="rb-display rb-display-lg mt-3 max-w-2xl">
            three certifications, fully built out.
          </h2>
          <p className="rb-body-lg mt-4 max-w-xl">
            Every topic below has lessons, practice questions, and assessments already in the
            system — not a syllabus we plan to fill in later.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {CERTIFICATIONS.map((c) => (
            <article
              key={c.title}
              data-landing-reveal
              className="grid overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_5px_0_var(--color-rb-swan)] lg:grid-cols-[300px_1fr]"
            >
              {/* colour panel carries identity; the wordmark bleeds off it */}
              <div className={`relative overflow-hidden p-7 ${TONE[c.tone].face}`}>
                <span className="pointer-events-none absolute -bottom-7 -right-3 select-none font-rb-display text-[5rem] font-black lowercase leading-none text-white/20">
                  {c.wordmark}
                </span>
                <c.icon className="relative size-9 text-white" aria-hidden="true" />
                <h3 className="relative mt-4 font-rb-display text-3xl font-extrabold lowercase leading-none text-white">
                  {c.title}
                </h3>
                <div className="relative mt-5 flex gap-4 text-white">
                  <span className="text-sm font-bold">
                    <span className="rb-numeric block text-xl text-white">{c.lessons}</span>
                    lessons
                  </span>
                  <span className="text-sm font-bold">
                    <span className="rb-numeric block text-xl text-white">{c.questions}</span>
                    questions
                  </span>
                </div>
              </div>

              <div className="flex flex-col p-7">
                <p className="rb-body max-w-2xl">{c.summary}</p>

                <div className="mt-6 flex-1">
                  <p className="rb-eyebrow">Topics covered</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {c.topics.map((topic) => (
                      <li
                        key={topic}
                        className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${TONE[c.tone].chip}`}
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>

                <TactileButton asChild variant={TONE[c.tone].btn} size="sm" className="mt-7 w-fit">
                  <Link to="/register">
                    start {c.title.toLowerCase()}
                    <ArrowRight className="size-4" />
                  </Link>
                </TactileButton>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- roadmap */
/* ----------------------------------------------------------------- olympics */

function OlympicsSection() {
  /* The same mode-select carousel the signed-in challenge hub uses: one arena
     at full size with the other two racked behind it, rather than three equal
     boxes. Picking a competitive format is a choice, and the carousel puts the
     choice itself on screen — a visitor sees the arena exactly as it will look
     once they are inside the product. */
  const [activeIndex, setActiveIndex] = useState(0);
  const activeMode = OLYMPICS_MODES[activeIndex];

  const move = (direction) =>
    setActiveIndex(
      (current) => (current + direction + OLYMPICS_MODES.length) % OLYMPICS_MODES.length
    );

  return (
    <section id="roadmap" className="scroll-mt-24 overflow-hidden bg-rb-polar px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal className="max-w-2xl">
          <p className="rb-eyebrow">it olympics</p>
          <h2 className="rb-display rb-display-lg mt-3">revision, but competitive.</h2>
          <p className="rb-body-lg mt-4">
            Three arenas built on the same question banks you study from. Two you can run solo any
            time; the World Cup needs seven other people.
          </p>
        </div>
      </div>

      <div
        data-landing-reveal
        className="mx-auto mt-12 max-w-[1280px]"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") move(-1);
          if (event.key === "ArrowRight") move(1);
        }}
        tabIndex={0}
        aria-label="Arena carousel"
      >
        <div className="relative h-[470px] sm:h-[490px]">
          {OLYMPICS_MODES.map((mode, index) => {
            const position = olympicsOffset(index, activeIndex);
            const isActive = position === 0;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => (isActive ? undefined : setActiveIndex(index))}
                className={`absolute left-1/2 top-1/2 isolate h-[430px] w-[280px] overflow-hidden rounded-rb-card border-2 text-left transition-all duration-500 ease-out [backface-visibility:hidden] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw sm:w-[320px] ${mode.surfaceClass} ${
                  isActive
                    ? "border-rb-macaw shadow-[0_26px_65px_-18px_rgba(27,110,243,0.45)]"
                    : "border-rb-swan shadow-[0_22px_55px_-18px_rgba(15,23,42,0.35)]"
                }`}
                style={{
                  transform: `translate(calc(-50% + ${position * 230}px), -50%) scale(${
                    isActive ? 1 : Math.abs(position) === 1 ? 0.82 : 0.66
                  })`,
                  zIndex: 10 - Math.abs(position),
                }}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${mode.name}${isActive ? ", selected" : ", select"}`}
              >
                <div
                  className="relative flex h-40 items-center justify-center overflow-hidden"
                  style={{ background: mode.accent }}
                >
                  <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
                    <span className="rounded-rb-pill bg-white/90 px-2.5 py-1 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-rb-eel backdrop-blur-sm">
                      {mode.tag}
                    </span>
                    <span className="rounded-rb-pill bg-black/35 px-2.5 py-1 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">
                      {mode.format}
                    </span>
                  </div>

                  <div className="absolute -right-8 -top-8 size-28 rounded-full bg-white/10" />
                  <div className="absolute -bottom-10 -left-7 size-32 rounded-full bg-white/10" />

                  <span
                    className={`grid size-24 place-items-center rounded-full bg-white/20 text-white transition-transform duration-500 ${
                      isActive ? "scale-100" : "scale-90"
                    }`}
                  >
                    <mode.icon className="size-12" strokeWidth={1.7} aria-hidden="true" />
                  </span>
                </div>

                <div className={`h-[286px] p-5 text-center ${mode.surfaceClass}`}>
                  <p className="font-rb-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-rb-macaw-lip">
                    {mode.role}
                  </p>
                  <span className="rb-display rb-display-md mt-1 block">{mode.name}</span>
                  <p className="mt-2 text-xs leading-5 text-rb-wolf">{mode.blurb}</p>

                  <span className="mt-3 flex flex-col items-start gap-1.5">
                    {mode.points.map((point) => (
                      <span
                        key={point}
                        className="flex items-start gap-2 text-left text-[11px] font-semibold text-rb-eel"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-rb-macaw-lip" aria-hidden="true" />
                        {point}
                      </span>
                    ))}
                  </span>

                  <span
                    className={`mx-auto mt-4 block h-1 rounded-full transition-all ${
                      isActive ? "w-14 bg-rb-macaw" : "w-6 bg-rb-swan"
                    }`}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous arena"
            className="grid size-11 place-items-center rounded-rb-pill border-2 border-rb-swan bg-rb-snow text-rb-eel transition-colors hover:border-rb-macaw focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>

          <div className="flex gap-1.5" aria-hidden="true">
            {OLYMPICS_MODES.map((mode, index) => (
              <span
                key={mode.id}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex ? "w-7 bg-rb-macaw" : "w-1.5 bg-rb-swan"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next arena"
            className="grid size-11 place-items-center rounded-rb-pill border-2 border-rb-swan bg-rb-snow text-rb-eel transition-colors hover:border-rb-macaw focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw"
          >
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* The hub's footer row: what is selected, and the one way in. Here the
            way in is registration — the arenas are behind a learner account. */}
        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div>
            <p className="rb-display rb-display-md">{activeMode.name}</p>
            <p className="mt-1 text-sm text-rb-wolf">{activeMode.format}</p>
          </div>

          <TactileButton asChild variant="macaw">
            <Link to="/register">
              enter arena
              <ArrowRight className="size-5" />
            </Link>
          </TactileButton>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- ai lab */

/**
 * The scripted exchange the tutor preview plays.
 *
 * Deliberately inside one lesson: the tutor is scope-limited to the lesson the
 * learner is on, so a preview where it answers anything at all would advertise
 * a product that does not exist. `parts` exists so the reply can be typed out
 * character by character and still carry emphasis — the typewriter reveals a
 * character count across the segments rather than a plain string.
 */
const TUTOR_CHAT = [
  {
    from: "learner",
    parts: [{ text: "What's the difference between 2NF and 3NF?" }],
  },
  {
    from: "tutor",
    parts: [
      { text: "2NF removes " },
      { text: "partial", strong: true },
      { text: " dependencies on a composite key. 3NF goes further and removes " },
      { text: "transitive", strong: true },
      { text: " ones — where a non-key column depends on another non-key column." },
    ],
    footer: "Want to practise this before moving on?",
    chips: ["make a quiz", "make flashcards"],
  },
  {
    from: "learner",
    parts: [{ text: "make a quiz" }],
  },
  {
    from: "tutor",
    parts: [
      { text: "Built you a five-question quiz on normalization, drawn from this lesson." },
    ],
    // The tutor hands back a quiz to open, not questions in the chat — asking
    // them inline here would show a flow the product does not have.
    action: { label: "take the quiz", icon: Zap },
  },
  {
    from: "learner",
    parts: [{ text: "make flashcards too" }],
  },
  {
    from: "tutor",
    parts: [
      { text: "24 cards, same lesson — the terms you have missed most come up first." },
    ],
    action: { label: "open the deck", icon: Layers },
  },
]

const CHAT_TIMING = {
  afterLearner: 800,
  typingIndicator: 1200,
  perCharacter: 16,
  afterTutor: 1800,
  beforeReplay: 3200,
}

function messageLength(message) {
  return message.parts.reduce((total, part) => total + part.text.length, 0)
}

/** Renders `parts` truncated to `revealed` characters, keeping the emphasis. */
function TypedParts({ parts, revealed }) {
  let consumed = 0
  return (
    <>
      {parts.map((part, partIndex) => {
        const start = consumed
        consumed += part.text.length
        const slice = part.text.slice(0, Math.max(0, revealed - start))
        if (!slice) return null
        return part.strong ? (
          <strong key={partIndex}>{slice}</strong>
        ) : (
          <span key={partIndex}>{slice}</span>
        )
      })}
    </>
  )
}

/** Three dots, while the tutor is composing. */
function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-rb-tile rounded-bl-md bg-rb-beetle-wash px-4 py-3.5">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="size-2 animate-bounce rounded-full bg-rb-beetle"
          style={{ animationDelay: `${dot * 0.16}s` }}
        />
      ))}
    </div>
  )
}

function ChatBubble({ message, revealed, showChips }) {
  const isLearner = message.from === "learner"

  return (
    <div
      className={
        "rb-pop-in " +
        (isLearner
          ? "ml-auto max-w-[85%] rounded-rb-tile rounded-br-md bg-rb-polar px-4 py-3 text-[0.9375rem] text-rb-eel"
          : "max-w-[92%] rounded-rb-tile rounded-bl-md bg-rb-beetle-wash px-4 py-3 text-[0.9375rem] text-rb-eel")
      }
    >
      <p>
        <TypedParts parts={message.parts} revealed={revealed} />
        {revealed < messageLength(message) ? (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-rb-beetle"
          />
        ) : null}
      </p>

      {message.footer && showChips ? (
        <p className="mt-2 text-sm text-rb-wolf">{message.footer}</p>
      ) : null}

      {message.chips && showChips ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.chips.map((chip) => (
            <Chip key={chip} tone="beetle">
              {chip}
            </Chip>
          ))}
        </div>
      ) : null}

      {/* What the tutor actually returns once it has generated something: a way
          into the quiz or the deck, not the questions themselves. */}
      {message.action && showChips ? (
        <span className="rb-pop-in mt-3 inline-flex items-center gap-2 rounded-rb-pill bg-rb-beetle px-4 py-2.5 font-rb-display text-sm font-extrabold lowercase text-rb-snow shadow-[0_3px_0_var(--color-rb-beetle-lip)]">
          <message.action.icon className="size-4" aria-hidden="true" />
          {message.action.label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  )
}

/**
 * The tutor preview, played rather than posed.
 *
 * A static transcript showed the shape of a conversation but not the thing that
 * makes a tutor feel like one — that it answers you while you wait. So the
 * exchange runs: the learner's message lands, the tutor thinks, types its reply
 * out, offers the quiz, and the learner takes it. Then it replays.
 *
 * Under `prefers-reduced-motion` the whole transcript is shown at once, with no
 * timers running at all.
 */
function TutorConversation() {
  const [reducedMotion, setReducedMotion] = useState(false)
  // How many messages are finished, and how far through the next one we are.
  const [done, setDone] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [thinking, setThinking] = useState(false)

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useEffect(() => {
    if (reducedMotion) return undefined

    const current = TUTOR_CHAT[done]

    // Past the last message: hold the finished transcript, then replay.
    if (!current) {
      const replay = window.setTimeout(() => {
        setDone(0)
        setRevealed(0)
      }, CHAT_TIMING.beforeReplay)
      return () => window.clearTimeout(replay)
    }

    if (current.from === "learner") {
      setThinking(false)
      setRevealed(messageLength(current))
      const next = window.setTimeout(
        () => setDone((n) => n + 1),
        CHAT_TIMING.afterLearner
      )
      return () => window.clearTimeout(next)
    }

    // Tutor: think first, then type. Advancing to the next message is left to
    // the effect below rather than done from inside the state updater — React
    // may call an updater more than once, and a timer scheduled in there gets
    // scheduled twice with it.
    setThinking(true)
    setRevealed(0)
    const total = messageLength(current)
    let typer = null

    const startTyping = window.setTimeout(() => {
      setThinking(false)
      typer = window.setInterval(() => {
        setRevealed((count) => (count >= total ? count : count + 1))
      }, CHAT_TIMING.perCharacter)
    }, CHAT_TIMING.typingIndicator)

    return () => {
      window.clearTimeout(startTyping)
      if (typer) window.clearInterval(typer)
    }
  }, [done, reducedMotion])

  // A tutor message that has finished typing holds, then hands over.
  useEffect(() => {
    if (reducedMotion) return undefined
    const current = TUTOR_CHAT[done]
    if (!current || current.from !== "tutor") return undefined
    if (thinking || revealed < messageLength(current)) return undefined

    const next = window.setTimeout(
      () => setDone((n) => n + 1),
      CHAT_TIMING.afterTutor
    )
    return () => window.clearTimeout(next)
  }, [done, revealed, thinking, reducedMotion])

  const visible = reducedMotion ? TUTOR_CHAT : TUTOR_CHAT.slice(0, done + 1)

  return (
    <RebyuCard raised data-landing-reveal className="!p-0">
      <div className="flex items-center gap-3 border-b-2 border-rb-swan px-5 py-4">
        <span className="grid size-10 place-items-center rounded-full bg-rb-beetle text-rb-snow">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="font-rb-display text-base font-extrabold lowercase text-rb-eel">
            rebyu tutor
          </div>
          <div className="text-xs font-semibold text-rb-hare">Databases · Normalization</div>
        </div>

        {/* Scoped, and says so: the tutor answers inside the lesson you are on. */}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-rb-pill bg-rb-feather-wash px-2.5 py-1 text-[0.6875rem] font-bold text-rb-feather-ink">
          <span className="size-1.5 animate-pulse rounded-full bg-rb-feather" aria-hidden="true" />
          in this lesson
        </span>
      </div>

      {/* Bottom-anchored at a fixed height: the transcript grows upward as a
          real one does, the card never changes size mid-conversation, and the
          earliest turns clip off the top the way a scrolled thread would. */}
      <div
        className="flex h-[392px] flex-col justify-end gap-4 overflow-hidden p-5"
        aria-live="polite"
        aria-atomic="false"
      >
        {visible.map((message, messageIndex) => {
          const isLast = messageIndex === visible.length - 1
          const settled = reducedMotion || !isLast
          if (!settled && thinking && message.from === "tutor") {
            return <TypingIndicator key={messageIndex} />
          }
          return (
            <ChatBubble
              key={messageIndex}
              message={message}
              revealed={settled ? messageLength(message) : revealed}
              showChips={settled || revealed >= messageLength(message)}
            />
          )
        })}
      </div>
    </RebyuCard>
  )
}

function AiTutorSection() {
  return (
    <section id="ai-tutor" className="scroll-mt-24 bg-rb-beetle-wash px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div data-landing-reveal>
          <p className="rb-eyebrow">ai tutor</p>
          <h2 className="rb-display rb-display-lg mt-3">a tutor that sits with you in the lesson.</h2>
          <p className="rb-body-lg mt-4 max-w-lg">
            Stuck on something mid-lesson? Ask. The tutor explains the concept you are on, in the
            lesson's own vocabulary — then turns it into a quiz or a flashcard deck so it sticks.
          </p>

          <div className="mt-8 space-y-3">
            {[
              [Brain, "Explains any concept while you are studying the lesson"],
              [Zap, "Turns what you just read into a practice quiz"],
              [Layers, "Builds a flashcard deck from the same lesson"],
            ].map(([Icon, text]) => (
              <div key={text} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rb-snow text-rb-beetle-lip">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="pt-1.5 text-[0.9375rem] font-medium text-rb-eel">{text}</p>
              </div>
            ))}
          </div>

          <TactileButton asChild variant="beetle" className="mt-8">
            <Link to="/register">
              try the ai tutor
              <ArrowRight className="size-5" />
            </Link>
          </TactileButton>
        </div>

        <TutorConversation />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- gamification */

/* What the mastery service actually returns per topic: an estimate, and a
   confidence in that estimate driven by how much evidence sits behind it. Both
   are shown — 40% mastery from three answers means something different from 40%
   from forty, and hiding that would overstate what the system knows. */
const TOPICS = [
  { name: "Normalization", domain: "Databases", mastery: 31, confidence: "high", answers: 42, priority: "high" },
  { name: "Subnetting", domain: "Networks", mastery: 38, confidence: "high", answers: 36, priority: "high" },
  { name: "Deadlock handling", domain: "Operating systems", mastery: 44, confidence: "medium", answers: 18, priority: "high" },
  { name: "Process scheduling", domain: "Operating systems", mastery: 57, confidence: "high", answers: 51, priority: "medium" },
  { name: "Cryptography basics", domain: "Security", mastery: 62, confidence: "low", answers: 7, priority: "medium" },
  { name: "Sorting algorithms", domain: "Programming", mastery: 79, confidence: "high", answers: 64, priority: "low" },
];

const CONFIDENCE_META = {
  high: { label: "high", bars: 3 },
  medium: { label: "medium", bars: 2 },
  low: { label: "low", bars: 1 },
};

/** Three-bar meter — how much evidence is behind the mastery estimate. */
function ConfidenceMeter({ level }) {
  const meta = CONFIDENCE_META[level];
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={`w-1 rounded-sm ${step <= meta.bars ? "bg-rb-eel" : "bg-rb-swan"}`}
          style={{ height: `${4 + step * 3}px` }}
        />
      ))}
    </span>
  );
}

function WeaknessSection() {

  return (
    <section className="bg-rb-snow px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal className="max-w-2xl">
          <p className="rb-eyebrow">mastery &amp; weak topics</p>
          <h2 className="rb-display rb-display-lg mt-3">
            it knows which topics you are weak at.
          </h2>
          <p className="rb-body-lg mt-4">
            Every answer updates a mastery level for the topic behind it, plus a confidence in that
            estimate. Low mastery with high confidence is the combination worth your next hour —
            those are the gaps the system is actually sure about.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* the ranked module list — the core of the feature */}
          <RebyuCard raised data-landing-reveal className="!p-0">
            <div className="flex items-center justify-between gap-3 border-b-2 border-rb-swan px-5 py-4">
              <div>
                <div className="rb-eyebrow">Mastery by topic</div>
                <div className="mt-1 font-rb-display text-lg font-extrabold lowercase text-rb-eel">
                  weakest first
                </div>
              </div>
              <Chip tone="macaw">
                <BarChart3 className="size-4" />
                auto-ranked
              </Chip>
            </div>

            <ul className="divide-y-2 divide-rb-swan">
              {TOPICS.map((topic) => {
                const meta = PRIORITY[topic.priority];
                const conf = CONFIDENCE_META[topic.confidence];
                return (
                  <li key={topic.name} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-rb-eel">{topic.name}</span>
                      <span className={`rb-chip !px-2.5 !py-1 !text-[0.6875rem] ${meta.chip}`}>
                        {meta.label}
                      </span>
                      <span className="rb-numeric ml-auto text-sm text-rb-eel">
                        {topic.mastery}%
                      </span>
                    </div>

                    <ProgressBar
                      value={topic.mastery}
                      tone={meta.bar}
                      label={`${topic.name} mastery`}
                      className="mt-2.5"
                    />

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-rb-wolf">
                      <span>{topic.domain}</span>
                      <span className="text-rb-hare" aria-hidden="true">·</span>
                      <span className="flex items-center gap-1.5">
                        <ConfidenceMeter level={topic.confidence} />
                        {conf.label} confidence
                      </span>
                      <span className="text-rb-hare" aria-hidden="true">·</span>
                      <span>{topic.answers} answers seen</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </RebyuCard>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {/* the weak list, stated plainly */}
            <RebyuCard raised data-landing-reveal>
              <div className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rb-cardinal-wash text-rb-cardinal-lip">
                  <Target className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="rb-numeric text-2xl leading-none">
                    {TOPICS.filter((t) => t.priority === "high").length} topics
                  </div>
                  <div className="mt-1 text-sm font-semibold text-rb-wolf">Currently weak</div>
                </div>
              </div>
              <ul className="mt-5 space-y-2">
                {TOPICS.filter((t) => t.priority === "high").map((topic) => (
                  <li
                    key={topic.name}
                    className="flex items-center gap-2 rounded-xl bg-rb-cardinal-wash px-3 py-2 text-sm font-bold text-rb-cardinal-lip"
                  >
                    <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                    <span className="rb-numeric text-sm text-rb-cardinal-lip">{topic.mastery}%</span>
                  </li>
                ))}
              </ul>
            </RebyuCard>

            {/* confidence in the estimates themselves, not exam readiness */}
            <RebyuCard raised data-landing-reveal>
              <div className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rb-feather-wash text-rb-feather-ink">
                  <Gauge className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="rb-numeric text-2xl leading-none">High</div>
                  <div className="mt-1 text-sm font-semibold text-rb-wolf">Overall confidence</div>
                </div>
              </div>
              <p className="rb-body mt-4 text-sm">
                Four of six topics have enough answers behind them for the estimate to be reliable.
                Cryptography basics needs more practice before its number means much.
              </p>
            </RebyuCard>

            <RebyuCard raised data-landing-reveal className="sm:col-span-2 lg:col-span-1">
              <div className="rb-eyebrow">Mastery by domain</div>
              <div className="mt-3">
                <DomainMasteryChart />
              </div>
              <p className="mt-3 text-sm text-rb-wolf">
                Two domains sit below the mastery target — those are what the plan works on first.
              </p>
            </RebyuCard>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ community */

function CommunitySection() {
  return (
    <section id="community" className="scroll-mt-24 bg-rb-macaw-wash px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* A feed, not a chat: posts carry real attachments — practice sets,
            notes, files — which is what the community is actually for. */}
        <div data-landing-reveal className="space-y-4">
          {FEED_POSTS.map((post) => (
            <RebyuCard key={post.author} raised className="!p-0">
              <div className="flex items-center gap-3 px-5 pt-5">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full font-rb-display text-sm font-extrabold lowercase ${post.avatar}`}
                  aria-hidden="true"
                >
                  {post.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-rb-eel">{post.author}</div>
                  <div className="text-xs font-semibold text-rb-hare">
                    {post.tag} · {post.when}
                  </div>
                </div>
                <span className={`rb-chip !px-2.5 !py-1 !text-[0.6875rem] ${post.kindChip}`}>
                  {post.kind}
                </span>
              </div>

              <p className="px-5 pt-3 text-[0.9375rem] leading-6 text-rb-eel">{post.text}</p>

              {/* the attachment is the point of the post */}
              <div className="mx-5 mt-4 flex items-center gap-3 rounded-rb-tile border-2 border-rb-swan bg-rb-polar p-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${post.attachTone}`}>
                  <post.attachIcon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-rb-eel">{post.attachName}</div>
                  <div className="text-xs font-semibold text-rb-wolf">{post.attachMeta}</div>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-rb-snow px-3 py-1.5 text-xs font-bold text-rb-macaw-lip">
                  {post.attachAction}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-5 border-t-2 border-rb-swan px-5 py-3 text-sm font-bold text-rb-wolf">
                <span className="flex items-center gap-1.5">
                  <Heart className="size-4" aria-hidden="true" />
                  {post.likes}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  {post.comments}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <Bookmark className="size-4" aria-hidden="true" />
                  save
                </span>
              </div>
            </RebyuCard>
          ))}
        </div>

        <div data-landing-reveal>
          <p className="rb-eyebrow">community</p>
          <h2 className="rb-display rb-display-lg mt-3">
            the best reviewer is another student.
          </h2>
          <p className="rb-body-lg mt-4 max-w-lg">
            A feed built for revision. Post a practice set you made, upload your notes, ask the
            question you're stuck on — and attempt, download, or save what everyone else shares.
          </p>

          <div className="mt-8 space-y-3">
            {[
              [Layers, "Share practice sets other learners can actually attempt"],
              [FileText, "Upload notes, reviewers, and past papers as real files"],
              [MessageCircle, "Ask a question and get answered by someone who just sat it"],
              [Bookmark, "Save anything useful straight into your own library"],
            ].map(([Icon, text]) => (
              <div key={text} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rb-snow text-rb-macaw-lip">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="pt-1.5 text-[0.9375rem] font-medium text-rb-eel">{text}</p>
              </div>
            ))}
          </div>

          <TactileButton asChild variant="macaw" className="mt-8">
            <Link to="/register">
              join a study circle
              <ArrowRight className="size-5" />
            </Link>
          </TactileButton>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- access */

function AccessCard({ icon: Icon, title, description, points, cta, to, tone }) {
  return (
    <RebyuCard raised data-landing-reveal className="flex flex-col">
      <span
        className={`grid size-14 place-items-center rounded-2xl ${
          tone === "feather"
            ? "bg-rb-feather-wash text-rb-feather-ink"
            : "bg-rb-humpback/10 text-rb-humpback"
        }`}
      >
        <Icon className="size-7" aria-hidden="true" />
      </span>

      <h3 className="rb-display rb-display-md mt-5">{title}</h3>
      <p className="rb-body mt-3">{description}</p>

      <div className="mt-6 flex-1 space-y-3 border-t-2 border-rb-swan pt-6">
        {points.map((point) => (
          <div key={point} className="flex items-start gap-3">
            <Check
              className={`mt-0.5 size-5 shrink-0 ${
                tone === "feather" ? "text-rb-feather" : "text-rb-humpback"
              }`}
              aria-hidden="true"
            />
            <span className="text-[0.9375rem] text-rb-eel">{point}</span>
          </div>
        ))}
      </div>

      <TactileButton
        asChild
        variant={tone === "feather" ? "feather" : "macaw"}
        className="mt-7 w-full"
      >
        <Link to={to}>
          {cta}
          <ArrowRight className="size-5" />
        </Link>
      </TactileButton>
    </RebyuCard>
  );
}

function AccessSection() {
  return (
    <section id="get-access" className="scroll-mt-24 bg-rb-polar px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal className="max-w-2xl">
          <p className="rb-eyebrow">get access</p>
          <h2 className="rb-display rb-display-lg mt-3">start on your own, or bring your school.</h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <AccessCard
            icon={GraduationCap}
            title="for learners"
            description="Study every lesson free. Upgrade when you want mock exams, analytics, and study plans."
            points={LEARNER_POINTS}
            cta="start reviewing"
            to="/register"
            tone="feather"
          />
          <AccessCard
            icon={Building2}
            title="for institutions"
            description="Give your learners certification access through a managed partnership."
            points={ENTERPRISE_POINTS}
            cta="request partnership"
            to="/enterprise/request-access"
            tone="humpback"
          />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- footer */

function Footer() {
  const COLUMNS = [
    {
      title: "platform",
      links: [
        ["Certifications", "#certifications"],
        ["Roadmap", "#roadmap"],
        ["AI tutor", "#ai-tutor"],
      ],
    },
    {
      title: "access",
      links: [
        ["Learner login", "/login"],
        ["Create account", "/register"],
        ["Institution access", "/enterprise/request-access"],
      ],
    },
    {
      title: "discover",
      links: [
        ["How it works", "#how-it-works"],
        ["Community", "#community"],
      ],
    },
    {
      title: "legal",
      links: [
        ["Terms of use", "/terms"],
        ["Privacy policy", "/privacy"],
        ["Guidelines", "/guidelines"],
      ],
    },
  ];

  return (
    <footer className="overflow-hidden border-t-2 border-rb-swan bg-rb-snow px-5 pt-16 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <BrandMark />
            <p className="rb-body mt-4 max-w-xs text-sm">
              Certification review for TOPCIT, IT Passport, and the FE exam.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="font-rb-display text-sm font-extrabold lowercase tracking-wide text-rb-eel">
                  {column.title}
                </h3>
                <ul className="mt-3 space-y-1">
                  {column.links.map(([label, href]) => (
                    <li key={href}>
                      {/* inline-block + padding keeps the tap target above the
                          24px pointer-target minimum on mobile */}
                      <a
                        href={href}
                        className="inline-block py-1.5 text-sm font-medium text-rb-wolf underline-offset-4 transition-colors hover:text-rb-feather hover:underline"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-12 border-t-2 border-rb-swan py-6 text-sm text-rb-hare">
          © {new Date().getFullYear()} Rebyu. All rights reserved.
        </p>
      </div>

      {/* oversized wordmark — the only decorative element on the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none flex select-none justify-center overflow-hidden leading-[0.72]"
      >
        <span className="font-rb-display text-[24vw] font-black lowercase tracking-tight text-rb-polar">
          rebyu
        </span>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------------- page */

export default function LandingPage() {
  const rootRef = useRef(null);

  /**
   * Scroll reveals via IntersectionObserver rather than a scroll-position
   * library: this route is lazy-loaded behind Suspense and its images settle
   * late, so anything measuring document offsets on mount reads a stale
   * layout and never fires. The observer needs no measurement, and because
   * the hiding class is added here in JS the page stays visible if this
   * effect never runs at all.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const targets = Array.from(root.querySelectorAll("[data-landing-reveal]"));
    const reveal = (element) => element.classList.add("rb-revealed");

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    targets.forEach((element) => element.classList.add("rb-reveal"));

    let delivered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        delivered = true;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    targets.forEach((element) => observer.observe(element));

    /* A working observer always delivers an initial callback for its targets,
       intersecting or not. If nothing arrives, the environment is not running
       the rendering loop — reveal everything rather than leave the page blank.
       Hidden marketing copy is a far worse outcome than a skipped animation. */
    const safetyNet = window.setTimeout(() => {
      if (!delivered) targets.forEach(reveal);
    }, 1200);

    return () => {
      window.clearTimeout(safetyNet);
      observer.disconnect();
      targets.forEach((element) => element.classList.remove("rb-reveal", "rb-revealed"));
    };
  }, []);

  return (
    <div ref={rootRef} className="rebyu-ds min-h-screen overflow-x-hidden">
      <LandingNavbar />
      <main>
        <HeroSection />
        <AboutSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <CertificationSection />
        <OlympicsSection />
        <AiTutorSection />
        <WeaknessSection />
        <CommunitySection />
        <AccessSection />
      </main>
      <Footer />
    </div>
  );
}
