import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
  BookOpen,
=======
  BarChart3,
  BookOpen,
  Bookmark,
  Brain,
  Briefcase,
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileText,
  Gift,
  Flag,
  Gauge,
  GraduationCap,
  Heart,
  Layers,
  Lock,
  Menu,
  MessageCircle,
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
  ShieldCheck,
  Target,
  TrendingUp,
  Users

} from "lucide-react";

import { Button } from "@/components/ui/button";
import communityStudy from "../../assets/community-study.webp";
import heroStudy from "../../assets/hero-study.webp";
import mockExam from "../../assets/mock-exam.webp";
import institutionLab from "../../assets/institution-lab.webp";
import { FeatureBento } from "./landing-feature-bento.jsx";
import { RoadmapSection } from "./landing-roadmap-section.jsx";

gsap.registerPlugin(ScrollTrigger);
=======
  Network,
  RotateCw,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Chip, ProgressBar, RebyuCard, TactileButton } from "@/components/rebyu/rebyu-ui.jsx";
import {
  DomainMasteryChart,
  MasteryChart,
  RetentionChart,
} from "./landing-charts.jsx";
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx

const NAV_ITEMS = [
  { label: "about", href: "#about" },
  { label: "the problem", href: "#problem" },
  { label: "how it works", href: "#how-it-works" },
  { label: "certifications", href: "#certifications" },
  { label: "arenas", href: "#roadmap" },
  { label: "ai tutor", href: "#ai-tutor" },
  { label: "community", href: "#community" },
];

/* Hero workspace demo — the two assessment types that need a real desktop
   surface. Code is tokenised by hand rather than run through a highlighter:
   it is a fixed marketing sample, so shipping a parser for it would be waste. */
const CODE_LINES = [
  [["def ", "kw"], ["is_prime", "fn"], ["(n):", "pl"]],
  [["    if ", "kw"], ["n ", "pl"], ["< ", "op"], ["2", "num"], [":", "pl"]],
  [["        return ", "kw"], ["False", "num"]],
  [["    for ", "kw"], ["i ", "pl"], ["in ", "kw"], ["range", "fn"], ["(", "pl"], ["2", "num"], [", ", "pl"], ["int", "fn"], ["(n ", "pl"], ["** ", "op"], ["0.5", "num"], [") ", "pl"], ["+ ", "op"], ["1", "num"], ["):", "pl"]],
  [["        if ", "kw"], ["n ", "pl"], ["% ", "op"], ["i ", "pl"], ["== ", "op"], ["0", "num"], [":", "pl"]],
  [["            return ", "kw"], ["False", "num"]],
  [["    return ", "kw"], ["True", "num"]],
];

const CODE_TOKEN_CLASS = {
  kw: "text-rb-beetle-lip",
  fn: "text-rb-macaw-lip",
  num: "text-rb-fox-lip",
  op: "text-rb-cardinal-lip",
  pl: "text-rb-eel",
};

const TEST_CASES = [
  { label: "rejects n < 2", state: "pass" },
  { label: "detects 7, 13, 97", state: "pass" },
  { label: "rejects even numbers", state: "pass" },
  { label: "handles n = 1000003", state: "running" },
];

/* Entity-relationship canvas. Positions are authored against a 520x260 viewBox
   so the SVG scales cleanly inside the editor pane at every breakpoint. */
const ER_ENTITIES = [
  { id: "student", label: "STUDENT", x: 16, y: 40, fields: ["student_id  PK", "name"] },
  { id: "enrollment", label: "ENROLLMENT", x: 196, y: 110, fields: ["student_id  FK", "course_id   FK"], selected: true },
  { id: "course", label: "COURSE", x: 376, y: 40, fields: ["course_id   PK", "title"] },
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
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
    type: "Certification review",
    description:
        "Prepare across software development, databases, networking, and information systems.",
    image: heroStudy,
  },
  {
    title: "IT Passport",
    type: "Certification review",
    description:
        "Build a practical foundation in strategy, management, and technology topics.",
    image: communityStudy,
  },
  {
    title: "Private Reviewer",
    type: "Private review space",
    description:
        "Organize your own study materials into a private lesson and assessment space.",
    image: mockExam,
=======
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
  },
];

/* Blade fills for the arena blades — saturated so white type holds across the
   full panel height. */
const BLADE_FILL = {
  macaw: "bg-gradient-to-b from-rb-macaw to-rb-macaw-lip",
  beetle: "bg-gradient-to-b from-rb-beetle to-rb-beetle-lip",
  bee: "bg-gradient-to-b from-rb-bee to-rb-bee-lip",
};

/* IT Olympics — two solo endurance modes plus the synchronised 8-player
   tournament. `format` is the honest distinction between them, and it is what
   the card leads with: solo runs can be started any time, the World Cup needs
   seven other people. */
const OLYMPICS_MODES = [
  {
    id: "codestrike",
    name: "codestrike",
    format: "solo · 10 problems",
    tone: "macaw",
    icon: Code2,
    blurb:
      "Ten coding problems back to back. Your code runs against real unit tests as you type, and scoring rewards correctness, speed, and time complexity — not just a green tick.",
    points: ["Live judge with split-screen tests", "Scored on Big-O efficiency", "Global and tier ranking"],
    to: "/learner/challenges/codestrike",
  },
  {
    id: "blueprint",
    name: "blueprint arena",
    format: "solo · 10 problems",
    tone: "beetle",
    icon: Network,
    blurb:
      "Ten UML and system design problems on a drag-and-drop canvas. Submissions are checked against structural rules, so marking is consistent rather than subjective.",
    points: ["Pre-loaded architecture components", "Structural validation, not opinion", "Accuracy score and rank tier"],
    to: "/learner/challenges/blueprint-arena",
  },
  {
    id: "worldcup",
    name: "world cup",
    format: "8 players · live bracket",
    tone: "bee",
    icon: Trophy,
    blurb:
      "Pick your track, queue into an eight-player lobby, and fight through quarterfinals, semis, and a grand final — everyone answering from the same syllabus.",
    points: ["Track-locked matchmaking", "Timed 1v1 bracket rounds", "MVP and match awards"],
    to: "/learner/challenges/world-cup",
  },
];

/* Priority is derived, not chosen: it ranks how weak the learner is against how
   heavily the exam weights that domain. Shared by the roadmap path and the
   module list so one concept never wears two different looks. Labels stay plain
   words — a learner should never have to decode a badge. */
const PRIORITY = {
  high: { label: "high priority", chip: "bg-rb-cardinal-wash text-rb-cardinal-lip", bar: "cardinal" },
  medium: { label: "worth a look", chip: "bg-rb-fox-wash text-rb-fox-lip", bar: "fox" },
  low: { label: "low priority", chip: "bg-rb-polar text-rb-wolf", bar: "mask" },
  done: { label: "mastered", chip: "bg-rb-feather-wash text-[#3d6b06]", bar: "feather" },
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
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
    name: "Glyzel Galagar",
    role: "Founder & Backend Lead",
    description: "Product direction, Spring Boot services, platform architecture, and AI integration.",
    image: heroStudy,
    position: "object-[48%_38%]",
  },
  {
    name: "Frontend Team",
    role: "Frontend Development",
    description: "Learner interfaces, responsive experiences, assessments, and product interactions.",
    image: communityStudy,
    position: "object-[46%_36%]",
  },
  {
    name: "Design Team",
    role: "UI/UX & Visual Design",
    description: "Research, interface systems, brand direction, and accessible learning experiences.",
    image: institutionLab,
    position: "object-[54%_34%]",
  },
  {
    name: "Academic Team",
    role: "Content & Assessment",
    description: "Curriculum structure, reviewer quality, question design, and certification alignment.",
    image: mockExam,
    position: "object-[52%_30%]",
  },
];

function BrandMark({ compact = false }) {
  return (
      <span className="flex items-center gap-2.5">
      <span
          className={`flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ${
              compact ? "size-8" : "size-9"
          }`}
      >
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span className="font-heading text-lg font-bold tracking-tight text-foreground">
        REBYU
      </span>
=======
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
    kindChip: "bg-rb-bee-wash text-[#8a6d00]",
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

const TEAM_MEMBERS = [
  { name: "Glyzel Galagar", role: "Hacker", initials: "gg", tone: "feather" },
  { name: "Daniel Kane Isidore Mapano", role: "Project Manager", initials: "dm", tone: "macaw" },
  { name: "Ivan Cortes", role: "Tester", initials: "ic", tone: "fox" },
  { name: "Joshua Inoc", role: "Hipster", initials: "ji", tone: "beetle" },
];

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandLogo className="size-9" />
      <span className="rb-display text-2xl leading-none">rebyu</span>
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
    </span>
  );
}

<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
function LandingNavbar({ shellRef, logoRef }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
=======
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

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
=======
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
  }, [mobileMenuOpen]);

  const close = () => setMobileMenuOpen(false);

  return (
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
        <div
            ref={shellRef}
            style={{
              willChange:
                  "max-width, border-radius, background-color, border-color, box-shadow, backdrop-filter",
            }}
            className={`pointer-events-auto mx-auto max-w-[1520px] overflow-hidden transition-colors duration-300 ${
                mobileMenuOpen
                    ? "rounded-[22px] border border-white/65 bg-[#FCFDFF]/95 shadow-[0_18px_45px_rgba(11,31,58,0.12)] backdrop-blur-xl"
                    : "border border-transparent bg-transparent"
            }`}
        >
          <div className="relative flex h-[68px] items-center justify-between px-4 sm:px-5 lg:px-6">
            <Link
                ref={logoRef}
                to="/welcome"
                onClick={closeMobileMenu}
                className="relative z-10 flex origin-left items-center gap-2.5"
            >
              <BrandMark />
            </Link>

            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 whitespace-nowrap xl:flex">
              {NAV_ITEMS.map((item) => (
                  <a
                      key={item.href}
                      href={item.href}
                      className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.label}
                  </a>
              ))}
            </nav>

            <div className="relative z-10 hidden items-center gap-2.5 xl:flex">
              <Button
                  asChild
                  variant="ghost"
                  className="rounded-md text-foreground hover:bg-accent"
=======
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
              >
                {item.label}
              </a>
            ))}
          </nav>

<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
              <Button
                  asChild
                  className="whitespace-nowrap rounded-md px-5 shadow-sm"
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
                className="relative z-10 ml-auto rounded-md text-foreground hover:bg-accent xl:hidden"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
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
                  className="overflow-hidden border-t border-[#D9E3F2] xl:hidden"
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
                      className="rounded-full border-[#C8D7F0] bg-white text-[#0B1F3A]"
                  >
                    <Link to="/login" onClick={closeMobileMenu}>
                      Log in
                    </Link>
                  </Button>

                  <Button
                      asChild
                      className="rounded-full bg-[#275DF5] text-white hover:bg-[#153FBE]"
                  >
                    <Link to="/register" onClick={closeMobileMenu}>
                      Get started
                    </Link>
                  </Button>
                </div>
              </div>
          ) : null}
=======
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
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

<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
function HeroNetworkVisual({ visualRef }) {
  return (
      <div
          ref={visualRef}
          className="hero-network relative mx-auto h-[175px] w-full max-w-[920px] shrink-0 sm:h-[205px] lg:h-[215px]"
          aria-hidden="true"
      >
        <svg
            viewBox="0 0 1000 280"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
        >
          {[
            "M 500 132 L 132 132",
            "M 500 132 L 252 42",
            "M 500 132 L 306 216",
            "M 500 132 L 868 132",
            "M 500 132 L 748 42",
            "M 500 132 L 694 216",
          ].map((path) => (
              <path
                  key={path}
                  d={path}
                  className="hero-network-path"
                  fill="none"
                  stroke="#DCE3EC"
                  strokeWidth="1.5"
                  strokeLinecap="round"
              />
          ))}

          {[
            [414, 132],
            [357, 82],
            [382, 176],
            [586, 132],
            [643, 82],
            [618, 176],
          ].map(([cx, cy]) => (
              <circle
                  key={`${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill="#315EF6"
                  className="hero-network-dot"
              />
          ))}
        </svg>

        <div className="hero-network-node absolute left-[6%] top-[34%] hidden size-[58px] -translate-y-1/2 overflow-hidden rounded-2xl border-4 border-white bg-[#E8ECF2] shadow-[0_14px_30px_rgba(11,31,58,0.14)] sm:block">
          <img
              src={heroStudy}
              alt=""
              className="h-full w-full object-cover"
          />
        </div>

        <div className="hero-network-node absolute left-[19%] top-[4%] flex size-[52px] items-center justify-center rounded-2xl bg-[#FFD44D] text-[#453600] shadow-[0_14px_30px_rgba(11,31,58,0.12)] sm:size-[58px]">
          <Target className="size-6" />
        </div>

        <div className="hero-network-node absolute left-[25%] top-[65%] flex size-[54px] items-center justify-center rounded-2xl bg-[#27BDEB] text-white shadow-[0_14px_30px_rgba(11,31,58,0.12)] sm:size-[60px]">
          <BookOpen className="size-6" />
        </div>

        <div className="hero-network-node absolute left-1/2 top-[47%] flex size-[86px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#315EF6] to-[#6D4BFF] text-white shadow-[0_22px_48px_rgba(75,74,230,0.28)] sm:size-[96px]">
          <Check className="size-11 stroke-[2.4]" />
        </div>

        <div className="hero-network-node absolute right-[19%] top-[4%] flex size-[52px] items-center justify-center rounded-2xl bg-[#FF6B4A] text-white shadow-[0_14px_30px_rgba(11,31,58,0.12)] sm:size-[58px]">
          <FileQuestion className="size-6" />
        </div>

        <div className="hero-network-node absolute right-[25%] top-[65%] hidden size-[54px] overflow-hidden rounded-2xl border-4 border-white bg-[#E8ECF2] shadow-[0_14px_30px_rgba(11,31,58,0.14)] sm:block sm:size-[60px]">
          <img
              src={communityStudy}
              alt=""
              className="h-full w-full object-cover"
          />
        </div>

        <div className="hero-network-node absolute right-[6%] top-[34%] hidden size-[58px] -translate-y-1/2 items-center justify-center rounded-2xl border border-[#E4E9F0] bg-white text-[#0B1F3A] shadow-[0_14px_30px_rgba(11,31,58,0.12)] sm:flex">
          <TrendingUp className="size-6" />
        </div>

        <div className="hero-network-node absolute bottom-[1%] left-[43%] hidden size-[48px] overflow-hidden rounded-2xl border-4 border-white bg-[#E8ECF2] shadow-[0_12px_26px_rgba(11,31,58,0.12)] md:block">
          <img
              src={mockExam}
              alt=""
              className="h-full w-full object-cover"
          />
        </div>

        <div className="hero-network-node absolute bottom-[4%] right-[38%] hidden size-[48px] items-center justify-center rounded-2xl bg-[#F0F3F8] text-[#315EF6] shadow-[0_12px_26px_rgba(11,31,58,0.10)] md:flex">
          <Users className="size-5" />
        </div>
      </div>
  );
}

function HeroVideo({ videoRef }) {
  return (
      <div
          ref={videoRef}
          style={{ transformStyle: "preserve-3d" }}
          className="hero-video relative mx-auto mt-12 w-full max-w-5xl rounded-[1.5rem] border border-white/60 bg-white/40 p-2 shadow-[0_24px_60px_rgba(11,31,58,0.08)] backdrop-blur-md sm:p-3 lg:mt-16"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-[1rem] bg-[#0B1F3A] shadow-inner">
          <iframe
              className="absolute inset-0 h-full w-full border-0"
              src="https://www.youtube.com/embed/M7lc1UVf-VE?rel=0&showinfo=0&autohide=1"
              title="REBYU Platform Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
          ></iframe>
        </div>
      </div>
  );
}

function HeroSection({ sectionRef, canvasRef, textRef, visualRef, videoRef }) {
  return (
      <section
          ref={sectionRef}
          className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.72),transparent_38%),linear-gradient(180deg,#EEF4FF_0%,#F3F7FF_72%,#FFFFFF_100%)]"
      >
        <div
            ref={canvasRef}
            className="relative flex min-h-screen w-full flex-col items-center justify-start px-5 pb-14 pt-[96px] sm:px-8 sm:pb-16 sm:pt-[104px] lg:px-12 lg:pb-20 lg:pt-[108px]"
        >
          <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center justify-center">
            <HeroNetworkVisual visualRef={visualRef} />

            <div ref={textRef} className="relative mx-auto mt-1 w-full max-w-3xl text-center">
              <p className="hero-kicker text-xs font-bold uppercase tracking-[0.14em] text-[#1D4ED8]">
                One connected review experience
              </p>

              <h1 className="hero-title mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-[#0B1F3A] sm:text-6xl lg:text-[4rem]">
                Stop scrambling for reviewers. Start actually preparing.
              </h1>

              <p className="hero-copy mx-auto mt-5 max-w-xl text-sm leading-6 text-[#6A7688] sm:text-base sm:leading-7">
                Organize your review, focus on weak areas, and prepare confidently for your certification.
              </p>
            </div>

            <HeroVideo videoRef={videoRef} />
          </div>
=======
/* ------------------------------------------------------- hero signature card */

/** Fixed-width exam clock. Counts down so the workspace reads as live. */
/** Fixed-width exam clock. Counts down so the workspace reads as live. */
function ExamClock({ running }) {
  const [seconds, setSeconds] = useState(4364);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const pad = (value) => String(value).padStart(2, "0");
  const clock = pad(Math.floor(seconds / 3600)) + ":" + pad(Math.floor((seconds % 3600) / 60)) + ":" + pad(seconds % 60);

  return <span className="rb-numeric text-sm tracking-wide text-rb-eel">{clock}</span>;
}

/* ---------------------------------------------------------------- answer panes */

function McqPane() {
  const OPTIONS = [
    "It removes transitive dependencies",
    "It removes partial dependencies on a composite key",
    "It requires every determinant to be a candidate key",
    "It eliminates repeating groups",
  ];

  return (
    <div className="space-y-2.5">
      {OPTIONS.map((option, index) => (
        <div key={option} data-state={index === 1 ? "selected" : "idle"} className="rb-answer">
          <span className="rb-answer-key">{"abcd"[index]}</span>
          <span className="min-w-0 flex-1">{option}</span>
        </div>
      ))}
    </div>
  );
}

function ShortAnswerPane() {
  return (
    <div>
      <label className="rb-eyebrow" htmlFor="hero-short">
        Your answer
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-rb-tile border-2 border-rb-macaw bg-rb-snow px-4 py-3.5">
        <span id="hero-short" className="font-mono text-[0.9375rem] font-semibold text-rb-eel">
          Second Normal Form
        </span>
        <span className="inline-block h-5 w-[2px] animate-pulse bg-rb-macaw" aria-hidden="true" />
      </div>
      <p className="mt-2 text-xs font-semibold text-rb-wolf">
        Accepts known variations — "2NF", "second normal form".
      </p>
    </div>
  );
}

function DescriptivePane() {
  return (
    <div>
      <label className="rb-eyebrow" htmlFor="hero-desc">
        Your answer
      </label>
      <div
        id="hero-desc"
        className="mt-2 min-h-[196px] rounded-rb-tile border-2 border-rb-bee bg-rb-snow p-4 text-[0.9375rem] leading-6 text-rb-eel"
      >
        A composite key means the primary key spans two columns. If a non-key column depends on
        only one of them, that is a partial dependency — so the table is in 1NF but not 2NF.
        <span className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-pulse bg-rb-bee" aria-hidden="true" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-rb-wolf">
        <span>Marked against a rubric</span>
        <span className="tabular-nums">248 / 600 characters</span>
      </div>
    </div>
  );
}

function ProgrammingPane() {
  return (
    <div className="flex h-full flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-rb-tile border-2 border-rb-swan bg-rb-polar">
        <div className="flex items-center gap-2 border-b-2 border-rb-swan bg-rb-snow px-3 py-2">
          <span className="rb-chip !bg-rb-macaw-wash !px-2.5 !py-1 !text-[0.6875rem] !text-rb-macaw-lip">
            solution.py
          </span>
          <span className="text-[0.6875rem] font-bold text-rb-hare">python 3.11</span>
        </div>

        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[0.8125rem] leading-6">
          <code>
            {CODE_LINES.map((line, lineIndex) => (
              <div key={lineIndex} className="flex gap-3 whitespace-pre">
                <span className="w-4 shrink-0 select-none text-right text-rb-hare">
                  {lineIndex + 1}
                </span>
                <span>
                  {line.map(([text, token], tokenIndex) => (
                    <span key={tokenIndex} className={CODE_TOKEN_CLASS[token]}>
                      {text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
            <div className="flex gap-3">
              <span className="w-4 shrink-0 select-none text-right text-rb-hare">8</span>
              <span className="inline-block h-4 w-[2px] animate-pulse bg-rb-macaw" />
            </div>
          </code>
        </pre>
      </div>

      <div className="w-full shrink-0 lg:w-52">
        <div className="rb-eyebrow">Test results</div>
        <div className="mt-2.5 space-y-2">
          {TEST_CASES.map((test) => (
            <div
              key={test.label}
              className={
                "flex items-start gap-2 rounded-xl px-3 py-2 text-[0.8125rem] font-medium " +
                (test.state === "pass"
                  ? "bg-rb-feather-wash text-[#3d6b06]"
                  : "bg-rb-polar text-rb-wolf")
              }
            >
              {test.state === "pass" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <span className="mt-1 size-3 shrink-0 animate-spin rounded-full border-2 border-rb-hare border-t-transparent" />
              )}
              <span className="min-w-0">{test.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiagramPane() {
  return (
    <div className="flex h-full flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-rb-tile border-2 border-rb-swan bg-rb-polar">
        <div className="flex items-center gap-2 border-b-2 border-rb-swan bg-rb-snow px-3 py-2">
          <span className="rb-chip !bg-rb-beetle-wash !px-2.5 !py-1 !text-[0.6875rem] !text-rb-beetle-lip">
            er-diagram
          </span>
          <span className="text-[0.6875rem] font-bold text-rb-hare">crow's foot</span>
        </div>

        <svg viewBox="0 0 520 260" preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Entity relationship diagram">
          <path d="M126 78 L240 128" stroke="var(--color-rb-hare)" strokeWidth="2" fill="none" />
          <path d="M356 128 L470 78" stroke="var(--color-rb-hare)" strokeWidth="2" fill="none" />

          {ER_ENTITIES.map((entity) => (
            <g key={entity.id}>
              <rect
                x={entity.x}
                y={entity.y}
                width={128}
                height={76}
                rx={12}
                fill="var(--color-rb-snow)"
                stroke={entity.selected ? "var(--color-rb-beetle)" : "var(--color-rb-swan)"}
                strokeWidth={entity.selected ? 3 : 2}
              />
              <rect
                x={entity.x}
                y={entity.y}
                width={128}
                height={24}
                rx={12}
                fill={entity.selected ? "var(--color-rb-beetle-wash)" : "var(--color-rb-polar)"}
              />
              <text x={entity.x + 10} y={entity.y + 16} className="font-mono" fontSize="10" fontWeight="700" fill="var(--color-rb-eel)">
                {entity.label}
              </text>
              {entity.fields.map((field, fieldIndex) => (
                <text key={field} x={entity.x + 10} y={entity.y + 40 + fieldIndex * 15} className="font-mono" fontSize="9" fill="var(--color-rb-wolf)">
                  {field}
                </text>
              ))}
              {entity.selected
                ? [
                    [entity.x, entity.y],
                    [entity.x + 128, entity.y],
                    [entity.x, entity.y + 76],
                    [entity.x + 128, entity.y + 76],
                  ].map(([hx, hy]) => (
                    <rect key={hx + "-" + hy} x={hx - 4} y={hy - 4} width={8} height={8} fill="var(--color-rb-beetle)" />
                  ))
                : null}
            </g>
          ))}
        </svg>
      </div>

      <div className="w-full shrink-0 lg:w-52">
        <div className="rb-eyebrow">Shapes</div>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {["entity", "relation", "attribute", "weak", "derived", "multi"].map((shape) => (
            <div
              key={shape}
              className="grid aspect-square place-items-center rounded-xl border-2 border-rb-swan bg-rb-polar text-[0.625rem] font-bold text-rb-wolf"
            >
              {shape}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* The five question types a learner actually meets in an attempt. Types, badge
/* The five question types a learner meets in an attempt.
   `wide` types (programming, diagram) get the three-column layout: problem on
   the left, working surface in the centre, item navigation on the right. The
   rest run two columns — question and answer centre, navigation right.
   `subs` are the sub-questions the attempt engine supports on programming,
   diagram and descriptive items. */
const QUESTION_TYPES = [
  {
    id: "mcq",
    label: "Multiple Choice",
    badge: "border-rb-macaw bg-rb-macaw-wash text-rb-macaw-lip",
    number: 12,
    points: 2,
    prompt: "Which statement describes Second Normal Form?",
    Pane: McqPane,
  },
  {
    id: "short",
    label: "Short Answer",
    badge: "border-rb-macaw bg-rb-macaw-wash text-rb-macaw-lip",
    number: 13,
    points: 3,
    prompt: "Name the normal form that removes partial dependencies.",
    Pane: ShortAnswerPane,
  },
  {
    id: "descriptive",
    label: "Descriptive",
    badge: "border-rb-bee bg-rb-bee-wash text-[#8a6d00]",
    number: 14,
    points: 8,
    prompt: "Explain why a table with a composite key can sit in 1NF but not 2NF.",
    subs: [
      { key: "a", label: "Define partial dependency", done: true },
      { key: "b", label: "Apply it to the example", done: false },
    ],
    Pane: DescriptivePane,
  },
  {
    id: "programming",
    label: "Programming",
    badge: "border-rb-macaw bg-rb-macaw-wash text-rb-macaw-lip",
    number: 15,
    points: 12,
    wide: true,
    brief:
      "A number is prime when it has exactly two distinct divisors: 1 and itself. Your function is called once per test case and must handle inputs up to one million within the time limit.",
    constraints: ["2 <= n <= 1,000,003", "Time limit 1s", "Return a boolean"],
    prompt: "Implement is_prime(n) so it returns True only for prime numbers.",
    subs: [
      { key: "a", label: "Handle n < 2", done: true },
      { key: "b", label: "Trial division", done: true },
      { key: "c", label: "Optimise to root n", done: false },
    ],
    Pane: ProgrammingPane,
  },
  {
    id: "diagram",
    label: "Diagram",
    badge: "border-rb-beetle bg-rb-beetle-wash text-rb-beetle-lip",
    number: 16,
    points: 10,
    wide: true,
    brief:
      "A student enrols in many courses, and a course holds many students. Model this without a many-to-many edge directly between the two entities.",
    constraints: ["Crow's foot notation", "Mark primary keys", "Resolve the M:N"],
    prompt: "Model the many-to-many relationship between students and courses.",
    subs: [
      { key: "a", label: "Entities and attributes", done: true },
      { key: "b", label: "Junction entity", done: false },
      { key: "c", label: "Cardinality", done: false },
    ],
    Pane: DiagramPane,
  },
];

/** Sub-question tabs. Completion is shown per part, as in the attempt engine. */
function SubQuestionTabs({ subs }) {
  const activeIndex = subs.findIndex((s) => !s.done);
  return (
    <div>
      <div className="rb-eyebrow">Parts</div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {subs.map((sub, index) => (
          <span
            key={sub.key}
            className={
              "flex items-center gap-1.5 rounded-rb-pill border-2 px-3 py-1.5 text-xs font-bold " +
              (index === activeIndex
                ? "border-rb-eel bg-rb-snow text-rb-eel"
                : sub.done
                  ? "border-rb-feather bg-rb-feather-wash text-[#3d6b06]"
                  : "border-rb-swan bg-rb-polar text-rb-wolf")
            }
          >
            {sub.done ? <Check className="size-3.5" /> : null}
            {sub.key}. {sub.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Item navigation rail — always the right-hand column. */
function ItemNavigator({ current }) {
  return (
    <div className="shrink-0 border-rb-swan p-5 lg:w-52 lg:border-l-2">
      <div className="flex items-center justify-between">
        <span className="rb-eyebrow">Item navigation</span>
        <span className="rb-numeric text-xs text-rb-wolf">40 pts</span>
      </div>

      <div className="mt-3 grid grid-cols-8 gap-1.5 lg:grid-cols-5">
        {Array.from({ length: 20 }, (_, cell) => {
          const number = cell + 1;
          const isCurrent = number === current;
          const answered = number < current;
          const flagged = number === 9;
          return (
            <span
              key={number}
              className={
                "grid aspect-square place-items-center rounded-lg border-2 text-[0.6875rem] font-bold " +
                (isCurrent
                  ? "border-rb-eel bg-rb-snow text-rb-eel"
                  : flagged
                    ? "border-rb-bee bg-rb-bee-wash text-[#8a6d00]"
                    : answered
                      ? "border-rb-macaw bg-rb-macaw text-rb-snow"
                      : "border-rb-swan bg-rb-polar text-rb-hare")
              }
            >
              {number}
            </span>
          );
        })}
      </div>

      <div className="mt-4 hidden gap-2 text-[0.6875rem] font-semibold text-rb-wolf lg:grid">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-rb-macaw" /> answered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-rb-bee" /> flagged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded border-2 border-rb-eel bg-rb-snow" /> current
        </span>
      </div>
    </div>
  );
}

/** Problem brief — the left column, only on the wide question types. */
function ProblemBrief({ type }) {
  return (
    <div className="shrink-0 border-rb-swan p-5 lg:w-64 lg:border-r-2">
      <div className="rb-eyebrow">Problem</div>
      <p className="mt-2.5 text-sm leading-6 text-rb-eel">{type.brief}</p>

      <div className="mt-5">
        <div className="rb-eyebrow">Constraints</div>
        <ul className="mt-2.5 space-y-1.5">
          {type.constraints.map((constraint) => (
            <li key={constraint} className="flex gap-2 font-mono text-xs leading-5 text-rb-wolf">
              <span className="text-rb-hare">-</span>
              {constraint}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The hero visual: the assessment workspace learners actually sit exams in.
 *
 * Layout follows the real attempt page — three columns for programming and
 * diagram items (problem, working surface, navigation) and two for the written
 * types, with item navigation always on the right. It cycles all five types the
 * engine supports, because coverage is the claim being made.
 *
 * Auto-cycling stops under reduced motion. The frame is aria-hidden with an
 * sr-only equivalent: none of it is operable.
 */
function AssessmentWorkspace() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const timer = window.setTimeout(() => setIndex((n) => (n + 1) % QUESTION_TYPES.length), 5600);
    return () => window.clearTimeout(timer);
  }, [index, reducedMotion]);

  const active = QUESTION_TYPES[index];

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_6px_0_var(--color-rb-swan)]"
      >
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-rb-swan bg-rb-polar px-4 py-3">
          <span className="grid size-9 place-items-center rounded-xl text-rb-eel">
            <ArrowLeft className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="font-rb-display text-base font-extrabold lowercase text-rb-eel">
              topcit mock exam
            </div>
            <div className="text-xs font-semibold text-rb-wolf">
              Question {active.number} of 40 · Attempt 2
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden items-center gap-1.5 text-xs font-semibold text-rb-wolf sm:flex">
              <Check className="size-3.5" />
              Saved
            </span>
            <span className="flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan bg-rb-snow px-3 py-1.5">
              <Clock className="size-3.5 text-rb-wolf" />
              <ExamClock running={!reducedMotion} />
            </span>
          </div>
        </div>

        <div key={active.id} className="rb-pop-in flex min-h-[540px] flex-col lg:flex-row">
          {active.wide ? <ProblemBrief type={active} /> : null}

          <div className="flex min-w-0 flex-1 flex-col p-5 lg:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-rb-wolf">Item {active.number}</span>
              <span className="rounded-rb-pill bg-rb-polar px-2.5 py-1 text-[0.6875rem] font-bold text-rb-wolf">
                {active.points} pts
              </span>
              <span
                className={
                  "rounded-rb-pill border-2 px-2.5 py-1 text-[0.6875rem] font-bold " + active.badge
                }
              >
                {active.label}
              </span>
            </div>

            <p className="mt-3 min-h-[3.5rem] font-rb-display text-xl font-extrabold leading-snug text-rb-eel">
              {active.prompt}
            </p>

            {/* Slot is reserved whether or not the item has parts, so the card
                keeps one height across all five types as it cycles. */}
            <div className="mt-4 min-h-[74px]">
              {active.subs ? <SubQuestionTabs subs={active.subs} /> : null}
            </div>

            <div className="mt-5 h-[300px] lg:h-[316px]">
              <active.Pane />
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2.5 border-t-2 border-rb-swan pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan px-3.5 py-2 text-xs font-bold text-rb-wolf">
                <Flag className="size-3.5" />
                Flag
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan px-3.5 py-2 text-xs font-bold text-rb-wolf">
                Skip
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-rb-pill bg-rb-feather px-5 py-2.5 text-xs font-extrabold text-rb-snow shadow-[0_3px_0_var(--color-rb-feather-lip)]">
                Next
                <ArrowRight className="size-4" />
              </span>
            </div>
          </div>

          <ItemNavigator current={active.number} />
        </div>
      </div>

      <div aria-hidden="true" className="mt-4 flex flex-wrap justify-center gap-2">
        {QUESTION_TYPES.map((type, typeIndex) => (
          <span
            key={type.id}
            className={
              "rounded-rb-pill px-3 py-1.5 text-xs font-bold transition-colors " +
              (typeIndex === index ? "bg-rb-eel text-rb-snow" : "bg-rb-polar text-rb-wolf")
            }
          >
            {type.label}
          </span>
        ))}
      </div>

      <p className="sr-only">
        A preview of the Rebyu assessment workspace, cycling through the five question types it
        supports: multiple choice, short answer, descriptive, programming with a live test runner,
        and diagram questions on a canvas. Programming and diagram items show a problem brief on
        the left, the working surface in the centre and item navigation on the right; written types
        use the centre and right columns only. Programming, diagram and descriptive items are split
        into parts.
      </p>
    </div>
  );
}
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-rb-snow">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-52 hidden size-[720px] rounded-full bg-rb-feather-wash lg:block"
      />

      <div className="relative mx-auto w-full max-w-[1280px] px-5 py-16 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <Chip tone="feather">
            <Sparkles className="size-4" />
            topcit · it passport · fe exam
          </Chip>

          <h1 className="rb-display rb-display-xl mt-6">
            study what you don't know.
            <br />
            skip what you do.
          </h1>

          <p className="rb-body-lg mt-6 max-w-xl">
            Rebyu measures your mastery of every topic as you answer, then puts the weakest ones in
            front of you first. No more re-reading what you already know, and no more finding out
            what you missed on exam day.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

          <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-rb-wolf">
            <span className="size-2 rounded-full bg-rb-mask" aria-hidden="true" />
            Every lesson is free. Upgrade only for mock exams and analytics.
          </p>
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
        </div>

        <div className="mt-12 lg:mt-14">
          <AssessmentWorkspace />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- what it is */

function AboutSection() {
  return (
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      <section id="about" className="scroll-mt-24 bg-background px-5 py-24 sm:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-20">
          <figure
              data-landing-reveal
              className="relative min-h-[480px] overflow-hidden bg-[#E9EEF5] sm:rounded-[1.75rem]"
          >
            <img
                src={mockExam}
                alt="Learner completing a focused exam preparation session"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07162D]/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#AFC4FF]">
                A clearer starting point
              </p>
              <p className="mt-3 max-w-md text-2xl font-bold leading-tight">
                Study time should follow evidence, not guesswork.
              </p>
            </div>
          </figure>

          <div data-landing-reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#275DF5]">
              About REBYU
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-[#0B1F3A] sm:text-5xl">
              Certification preparation should not feel scattered.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#61728A]">
              REBYU brings diagnostic assessments, structured lessons, quizzes,
              middle exams, mock exams, and progress insights into one connected
              learning experience.
            </p>

            <div className="mt-9 border-y border-[#DCE5F0]">
              {[
                ["01", "Start with a diagnostic", "Find weak topics before lessons begin."],
                ["02", "Study in the right order", "Follow a plan built from actual results."],
                ["03", "Practice at every level", "Complete lesson quizzes, middle exams, and mock exams."],
                ["04", "Track your readiness", "Use your results to decide what to study next."],
              ].map(([number, title, description]) => (
                  <div
                      key={number}
                      className="grid gap-3 border-b border-[#E5EBF3] py-5 last:border-b-0 sm:grid-cols-[56px_1fr]"
                  >
                <span className="text-xs font-bold tracking-[0.14em] text-[#275DF5]">
                  {number}
                </span>
                    <div>
                      <h3 className="text-base font-bold text-[#0B1F3A]">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#6A7A91]">
                        {description}
                      </p>
                    </div>
                  </div>
              ))}
            </div>
          </div>
=======
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Layers, "Structured curriculum", "Ten units per certification, unlocked in order."],
            [Code2, "Real assessments", "Write code against test cases, build diagrams on a canvas."],
            [BarChart3, "Mastery tracking", "Every answer updates a per-topic estimate."],
            [Users, "Built for both", "Study on your own, or through your institution."],
          ].map(([Icon, title, body]) => (
            <RebyuCard key={title} raised data-landing-reveal>
              <span className="grid size-12 place-items-center rounded-2xl bg-rb-feather-wash text-[#3d6b06]">
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
        <RebyuCard raised data-landing-reveal className="lg:order-2">
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

        <div data-landing-reveal className="lg:order-1">
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
                  <Icon className="size-3.5 text-[#3d6b06]" aria-hidden="true" />
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
    feather: "bg-rb-feather-wash text-[#3d6b06]",
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
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
  return (
      <section
          id="certifications"
          className="border-y border-[#DCE5F0] bg-[#F7F9FC] px-5 py-24 sm:py-28 lg:px-8 lg:py-36"
      >
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#275DF5]">
              Certification reviewers
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-[#0B1F3A] sm:text-5xl">
              Choose the review path that matches your goal.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {CERTIFICATIONS.map((certification) => (
                <article
                    key={certification.title}
                    data-landing-reveal
                    className="group overflow-hidden border border-[#DCE5F0] bg-white"
                >
                  <div className="relative h-60 overflow-hidden">
                    <img
                        src={certification.image}
                        alt="Learners preparing for certification examinations"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07162D]/66 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-4 rounded-md bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#0B1F3A] shadow-sm">
                  {certification.type}
                </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-[#0B1F3A]">
                      {certification.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#64758E]">
                      {certification.description}
                    </p>
                  </div>
                </article>
            ))}
          </div>
=======
  /* A showcase, not a comparison: full-width bands that put each certification's
     actual topic list on the page. What a reader wants here is "what is in the
     system", and that is the topics — not a spec sheet of exam trivia. */
  const TONE = {
    macaw: { face: "bg-rb-macaw", chip: "bg-rb-macaw-wash text-rb-macaw-lip", btn: "macaw" },
    bee: { face: "bg-rb-bee", chip: "bg-rb-bee-wash text-[#8a6d00]", btn: "fox" },
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
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
  /* Mode select, not a card grid: three angled blades that expand on hover.
     Picking a competitive format is a choice between three things, and blades
     put them side by side at full height instead of stacking equal boxes. */
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
        className="rb-blades mt-12 h-[clamp(420px,60vh,560px)] lg:h-[56vh]"
      >
        {OLYMPICS_MODES.map((mode) => (
          <Link key={mode.id} to={mode.to} className={`rb-blade ${BLADE_FILL[mode.tone]}`}>
            <span className="rb-blade-ghost">{mode.name}</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent"
            />

            <span className="rb-blade-inner flex flex-col justify-end p-6 text-left lg:p-8">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-rb-pill bg-black/35 px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-white">
                <mode.icon className="size-3.5" aria-hidden="true" />
                {mode.format}
              </span>

              <span className="mt-3 block font-rb-display text-2xl font-black uppercase italic leading-none text-white drop-shadow lg:text-4xl">
                {mode.name}
              </span>

              <span className="rb-blade-detail mt-3 block">
                <span className="block max-w-sm text-sm leading-6 text-white/90">{mode.blurb}</span>
                <span className="mt-4 flex flex-col gap-1.5">
                  {mode.points.map((point) => (
                    <span key={point} className="flex items-center gap-2 text-xs font-semibold text-white/85">
                      <Check className="size-3.5 shrink-0" aria-hidden="true" />
                      {point}
                    </span>
                  ))}
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 rounded-rb-pill bg-white px-5 py-2.5 text-xs font-extrabold uppercase tracking-wide text-rb-eel">
                  enter arena
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- ai lab */

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

        {/* tutor conversation preview */}
        <RebyuCard raised data-landing-reveal className="!p-0">
          <div className="flex items-center gap-3 border-b-2 border-rb-swan px-5 py-4">
            <span className="grid size-10 place-items-center rounded-full bg-rb-beetle text-rb-snow">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="font-rb-display text-base font-extrabold lowercase text-rb-eel">
                rebyu tutor
              </div>
              <div className="text-xs font-semibold text-rb-hare">Databases · Normalization</div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="ml-auto max-w-[85%] rounded-rb-tile rounded-br-md bg-rb-polar px-4 py-3 text-[0.9375rem] text-rb-eel">
              What's the difference between 2NF and 3NF?
            </div>

            <div className="max-w-[92%] rounded-rb-tile rounded-bl-md bg-rb-beetle-wash px-4 py-3 text-[0.9375rem] text-rb-eel">
              <p>
                2NF removes <strong>partial</strong> dependencies on a composite key. 3NF goes
                further and removes <strong>transitive</strong> ones — where a non-key column
                depends on another non-key column.
              </p>
              <p className="mt-2 text-sm text-rb-wolf">
                Want to practise this before moving on?
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Chip tone="beetle">make a quiz</Chip>
              <Chip tone="beetle">make flashcards</Chip>
            </div>
          </div>
        </RebyuCard>
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
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rb-feather-wash text-[#3d6b06]">
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
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      <section id="community" className="scroll-mt-24 bg-[#0B1F3A] px-5 py-24 text-white sm:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-[4.5rem]">
          <figure
              data-landing-reveal
              className="relative min-h-[500px] overflow-hidden bg-[#152D4E] sm:rounded-[1.75rem]"
          >
            <img
                src={communityStudy}
                alt="College students studying together in a classroom"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07162D]/78 via-[#07162D]/10 to-transparent" />
            <figcaption className="absolute bottom-4 left-5 text-xs text-white/90">
              Photo by Yan Krukau on Pexels
            </figcaption>
          </figure>

          <div data-landing-reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9BB7FF]">
              Community and study circles
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
              Prepare with learners working toward the same certification.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#D5DEEA]">
              Ask certification-related questions, share study resources, and join
              focused discussions with learners preparing for the same goal.
            </p>

            <div className="mt-8 space-y-3">
              <div className="border border-white/[0.14] bg-white/[0.06] p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#AFC4FF]">
                  <Users className="size-4" aria-hidden="true" />
                  TOPCIT study circle
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white">
                  “Software Development review tonight. We will compare Agile and
                  Waterfall before taking the quiz.”
                </p>
                <p className="mt-3 text-xs font-medium text-[#C1CCDC]">8 learners joined</p>
              </div>
              <div className="border border-white/[0.14] bg-white/[0.06] p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#AFC4FF]">
                  <FileQuestion className="size-4" aria-hidden="true" />
                  Shared quiz
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white">
                  “I created a 15-item practice quiz for Database Normalization.”
                </p>
                <p className="mt-3 text-xs font-medium text-[#C1CCDC]">12 attempts · 4 replies</p>
              </div>
              <div className="flex items-center gap-3 pt-3 text-sm font-semibold text-[#AFC4FF]">
                <MessageCircle className="size-4" aria-hidden="true" />
                Discussions stay connected to certifications and lessons.
=======
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
              </div>
            </RebyuCard>
          ))}
        </div>

<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
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

        <div className="absolute inset-0 bg-gradient-to-t from-[#062536]/95 via-[#062536]/12 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
          <h3 className="text-xl font-bold tracking-[-0.025em]">
            {member.name}
          </h3>
          <p className="mt-2 text-xs font-medium text-white/90">
            {member.role}
=======
        <div data-landing-reveal>
          <p className="rb-eyebrow">community</p>
          <h2 className="rb-display rb-display-lg mt-3">
            the best reviewer is another student.
          </h2>
          <p className="rb-body-lg mt-4 max-w-lg">
            A feed built for revision. Post a practice set you made, upload your notes, ask the
            question you're stuck on — and attempt, download, or save what everyone else shares.
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
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

/* ----------------------------------------------------------------------- team */

function TeamSection() {
  return (
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      <section
          id="team"
          className="scroll-mt-24 bg-white px-5 py-24 sm:py-28 lg:px-8 lg:py-36"
      >
        <div className="mx-auto max-w-7xl">
          <div
              data-landing-reveal
              className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-4xl font-bold tracking-[-0.045em] text-[#0B1F3A] sm:text-5xl">
              Team
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#64758E] sm:text-base">
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
=======
    <section id="team" className="scroll-mt-24 bg-rb-snow px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal className="max-w-2xl">
          <p className="rb-eyebrow">team</p>
          <h2 className="rb-display rb-display-lg mt-3">the people building rebyu.</h2>
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM_MEMBERS.map((member) => {
            const TONE = {
              feather: "bg-rb-feather-wash text-[#3d6b06]",
              macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
              beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
              fox: "bg-rb-fox-wash text-rb-fox-lip",
            };

            return (
              <article
                key={member.name}
                data-landing-reveal
                className="group overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_4px_0_var(--color-rb-swan)]"
              >
                {/* initials stand in for the portrait — same footprint, no stock photo */}
                <div
                  className={`grid aspect-[4/3] place-items-center ${TONE[member.tone]}`}
                  aria-hidden="true"
                >
                  <span className="font-rb-display text-6xl font-black lowercase leading-none tracking-tight transition-transform duration-300 group-hover:scale-105">
                    {member.initials}
                  </span>
                </div>
                <div className="border-t-2 border-rb-swan p-5">
                  <h3 className="rb-display rb-display-sm">{member.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-rb-wolf">{member.role}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- access */

function AccessCard({ icon: Icon, title, description, points, cta, to, tone }) {
  return (
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      <div className={`flex h-full flex-col p-7 sm:p-9 ${dark ? "bg-[#0B1F3A] text-white" : "bg-white"}`}>
      <span
          className={`flex size-11 items-center justify-center rounded-xl ${
              dark ? "bg-white text-[#0B1F3A]" : "bg-[#E9EFFF] text-[#275DF5]"
          }`}
=======
    <RebyuCard raised data-landing-reveal className="flex flex-col">
      <span
        className={`grid size-14 place-items-center rounded-2xl ${
          tone === "feather"
            ? "bg-rb-feather-wash text-[#3d6b06]"
            : "bg-rb-humpback/10 text-rb-humpback"
        }`}
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
      >
        <Icon className="size-7" aria-hidden="true" />
      </span>
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
        <h3 className={`mt-6 text-2xl font-bold ${dark ? "text-white" : "text-[#0B1F3A]"}`}>
          {title}
        </h3>
        <p className={`mt-3 text-sm leading-6 md:min-h-[4.5rem] lg:min-h-24 ${dark ? "text-[#D5DEEA]" : "text-[#64758E]"}`}>
          {description}
        </p>
        <div className={`mt-7 flex-1 space-y-3 border-y py-6 ${dark ? "border-white/[0.14]" : "border-[#E1E8F2]"}`}>
          {points.map((point) => (
              <div key={point} className="flex items-start gap-3 text-sm">
                <Check
                    className={`mt-0.5 size-4 shrink-0 ${dark ? "text-[#AFC4FF]" : "text-[#275DF5]"}`}
                    aria-hidden="true"
                />
                <span className={dark ? "text-[#D5DEEA]" : "text-[#465A76]"}>
              {point}
            </span>
              </div>
          ))}
        </div>
        <Button
            asChild
            className={`mt-7 w-full rounded-lg ${
                dark
                    ? "bg-white text-[#0B1F3A] hover:bg-[#E9EEF5]"
                    : "bg-[#275DF5] text-white hover:bg-[#1D4ED8]"
            }`}
        >
          <Link to={to}>
            {button}
            <ArrowRight className="ml-2 size-4" aria-hidden="true" />
          </Link>
        </Button>
=======

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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
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
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      <section id="get-access" className="scroll-mt-24 bg-muted/40 px-5 py-24 sm:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[0.84fr_1.16fr]">
            <figure className="relative min-h-[400px] overflow-hidden bg-muted sm:min-h-[480px] lg:min-h-[560px]">
              <img
                  src={institutionLab}
                  alt="Teacher guiding learners in a computer laboratory"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07162D]/72 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B8CAFF]">
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
=======
    <section id="get-access" className="scroll-mt-24 bg-rb-polar px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div data-landing-reveal className="max-w-2xl">
          <p className="rb-eyebrow">get access</p>
          <h2 className="rb-display rb-display-lg mt-3">start on your own, or bring your school.</h2>
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
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
        ["Team", "#team"],
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
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      <footer className="relative overflow-hidden bg-gradient-to-b from-[#0B1F3A] to-[#040E1E] px-5 pt-24 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">
=======
    <footer className="overflow-hidden border-t-2 border-rb-swan bg-rb-snow px-5 pt-16 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <BrandMark />
            <p className="rb-body mt-4 max-w-xs text-sm">
              Certification review for TOPCIT, IT Passport, and the FE exam.
            </p>
          </div>
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx

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
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx

              {/* Socials */}
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                  Social
                </div>
                <div className="flex items-center gap-5">
                  <a href="#" aria-label="Twitter" className="text-[#9BB7FF] transition-colors hover:text-white">fdsaf</a>
                  <a href="#" aria-label="Instagram" className="text-[#9BB7FF] transition-colors hover:text-white">fsdaf</a>
                  <a href="#" aria-label="Facebook" className="text-[#9BB7FF] transition-colors hover:text-white">fasdf</a>
                  <a href="#" aria-label="YouTube" className="text-[#9BB7FF] transition-colors hover:text-white">fasdf</a>
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
                              className="text-sm text-[#9BB7FF] transition-colors hover:text-white hover:underline underline-offset-2"
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
          <span className="text-[25vw] font-black tracking-[-0.04em] text-[#0E2A54]">
            REBYU
          </span>
        </div>
      </footer>
=======
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
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
  );
}

/* ----------------------------------------------------------------------- page */

export default function LandingPage() {
  const rootRef = useRef(null);
<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
  const navShellRef = useRef(null);
  const navLogoRef = useRef(null);
  const heroRef = useRef(null);
  const heroCanvasRef = useRef(null);
  const heroTextRef = useRef(null);
  const heroVisualRef = useRef(null);
  const heroVideoRef = useRef(null);

  useLayoutEffect(() => {
=======

  /**
   * Scroll reveals via IntersectionObserver rather than a scroll-position
   * library: this route is lazy-loaded behind Suspense and its images settle
   * late, so anything measuring document offsets on mount reads a stale
   * layout and never fires. The observer needs no measurement, and because
   * the hiding class is added here in JS the page stays visible if this
   * effect never runs at all.
   */
  useEffect(() => {
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
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

<<<<<<< Updated upstream:frontend/src/pages/public/LandingPage.jsx
      const networkPaths = gsap.utils.toArray(".hero-network-path", root);
      const networkDots = gsap.utils.toArray(".hero-network-dot", root);
      const networkNodes = gsap.utils.toArray(".hero-network-node", root);

      networkPaths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
      });

      heroTimeline
          .from(heroCanvasRef.current, {
            opacity: 0,
            y: 28,
            scale: 0.985,
            duration: 0.72,
            delay: 0.1,
          })
          .to(
              networkPaths,
              {
                strokeDashoffset: 0,
                duration: 0.9,
                stagger: 0.05,
                ease: "power2.out",
              },
              "-=0.42",
          )
          .from(
              networkDots,
              {
                opacity: 0,
                scale: 0,
                transformOrigin: "center",
                duration: 0.35,
                stagger: 0.05,
              },
              "-=0.62",
          )
          .from(
              networkNodes,
              {
                opacity: 0,
                scale: 0.72,
                y: 18,
                duration: 0.5,
                stagger: {
                  each: 0.07,
                  from: "center",
                },
              },
              "-=0.48",
          )
          .from(".hero-kicker", { opacity: 0, y: 12, duration: 0.4 }, "-=0.18")
          .from(".hero-title", { opacity: 0, y: 30, duration: 0.7 }, "-=0.22")
          .from(".hero-copy", { opacity: 0, y: 16, duration: 0.5 }, "-=0.42")
          .from(heroVideoRef.current, { opacity: 0, y: 60, scale: 0.96, duration: 0.8 }, "-=0.3");

      gsap.set(navShellRef.current, {
        maxWidth: 1520,
        borderRadius: 0,
        borderColor: "rgba(255,255,255,0)",
        backgroundColor: "rgba(255,255,255,0)",
        boxShadow: "0 0 0 rgba(11,31,58,0)",
        backdropFilter: "blur(0px)",
      });

      gsap
          .timeline({
            scrollTrigger: {
              trigger: heroRef.current,
              start: "top top",
              end: "+=220",
              scrub: true,
            },
          })
          .to(
              navShellRef.current,
              {
                maxWidth: 1320,
                borderRadius: 22,
                borderColor: "rgba(255,255,255,0.65)",
                backgroundColor: "rgba(252,253,255,0.82)",
                boxShadow: "0 18px 45px rgba(11,31,58,0.12)",
                backdropFilter: "blur(16px)",
                ease: "none",
              },
              0,
          )
          .to(navLogoRef.current, { scale: 0.94, ease: "none" }, 0);

      gsap.to(heroVisualRef.current, {
        yPercent: -8,
        scale: 1.015,
        ease: "none",
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });

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

      // Video Scroll Animation (Parallax 3D Depth)
      gsap.to(heroVideoRef.current, {
        yPercent: -15,
        scale: 1.02,
        rotationX: 2,
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
        <LandingNavbar shellRef={navShellRef} logoRef={navLogoRef} />
        <main>
          <HeroSection
              sectionRef={heroRef}
              canvasRef={heroCanvasRef}
              textRef={heroTextRef}
              visualRef={heroVisualRef}
              videoRef={heroVideoRef}
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
=======
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
        <TeamSection />
        <AccessSection />
      </main>
      <Footer />
    </div>
>>>>>>> Stashed changes:frontend/src/pages/public/landing-page.jsx
  );
}