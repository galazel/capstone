# Rebyu Design System — Blueprint

Tactile, motivating certification review. Duolingo-derived colour and typographic
hierarchy; original visual identity.

**Status:** foundation + landing page are built and live. Modules 2–7 below are
specified against the shipped tokens and are ready to implement.

| Artifact | Path |
| --- | --- |
| Tokens, component CSS, motion | `frontend/src/styles/rebyu-ds.css` |
| React primitives | `frontend/src/components/rebyu/rebyu-ui.jsx` |
| Reference implementation | `frontend/src/pages/public/landing-page.jsx` |

---

## 1. Foundation

### How the theme reaches every page

Two layers, applied together:

1. **Semantic token retheme (global, automatic).** The shadcn/Tailwind tokens in
   `index.css` — `--primary`, `--background`, `--foreground`, `--border`,
   `--radius`, the chart ramp, the sidebar set, and the legacy `--brand-*`
   values — now resolve to the Rebyu palette. This happens in three blocks:
   `:root` (landing and auth), `.netacad-portal` (shared by the admin,
   institution, and learner layouts), and `.dark .netacad-portal`. Any page built
   on `bg-primary` / `text-foreground` / `border-border` or the shared shadcn
   primitives adopts the system without being edited.
2. **Tactile component layer (global, restrained).** Appended at the foot of
   `index.css`, plus rethemed portal rules mid-file. Buttons become pills with
   the Feather lip and press travel, cards go to 2px Swan borders at 16px,
   inputs to 2px at 12px with a Macaw focus ring, badges to pills, progress to
   Mask Green. Control **heights are deliberately left alone** so dense admin
   tables keep their density.

`.rebyu-ds` remains the opt-in scope for the *full* treatment — 56px controls,
the display type rules, the answer-option states. The landing page uses it. Add
it to any learner-facing surface that should feel like the product rather than
an admin tool.

Add `rb-a11y` next to `rebyu-ds` to switch on the darkened, AA-compliant faces
(see **Accessibility** below).

### Colour

Every token is namespaced `rb-`, so Tailwind utilities are additive and collide
with nothing: `bg-rb-feather`, `text-rb-eel`, `rounded-rb-card`.

**Core**

| Token | Hex | Use |
| --- | --- | --- |
| `rb-feather` | `#1B6EF3` | Primary actions, brand anchor. Lean here when unsure. |
| `rb-mask` | `#5AA9FF` | Success, progress fills, completion |
| `rb-eel` | `#4B4B4B` | All primary type — never pure black |
| `rb-snow` | `#FFFFFF` | Base canvas |

**Accents** — each carries one meaning and is not reused decoratively.

| Token | Hex | Owns |
| --- | --- | --- |
| `rb-macaw` | `#1CB0F6` | AI features, analytics, links |
| `rb-cardinal` | `#FF4B4B` | Errors, wrong answers, destructive |
| `rb-bee` | `#00B8D4` | Achievements, rewards, milestones |
| `rb-fox` | `#FF9600` | Streaks, challenges, active timers |
| `rb-beetle` | `#CE82FF` | Premium, AI insight |
| `rb-humpback` | `#2B70C9` | Brand depth, data viz |

**Neutrals:** `rb-eel` → `rb-wolf` `#777` (secondary copy) → `rb-hare` `#AFAFAF`
(hints, disabled) → `rb-swan` `#E5E5E5` (borders) → `rb-polar` `#F7F7F7`
(cards, fills) → `rb-snow`.

**Washes** — `rb-{accent}-wash` are the tinted full-bleed section backgrounds
(`rb-feather-wash`, `rb-macaw-wash`, `rb-beetle-wash`, …). Sections alternate
Snow → Polar → wash to build rhythm without borders everywhere.

**Lips** — every face has a `-lip` companion (`rb-feather-lip` `#46A302`). The
lip is the solid offset shadow under a control. It is what makes a button read
as a physical key rather than a rectangle. Never blur it.

### Typography

The licensed pair is **Feather Bold** (display) and **DIN Next Rounded** (body).
Both lead their stacks. **Nunito** and **Nunito Sans** ship as fallbacks — same
rounded terminals and geometric skeleton, so voice and metrics hold when the
licensed files are absent.

To self-host the licensed faces: drop woff2 files into `frontend/public/fonts/`
and uncomment the `@font-face` block in `rebyu-ds.css`. Nothing else changes.

**Rules**

- Display headings are **lowercase and left-aligned by rule**, applied through
  the `.rb-display` class rather than decided per instance.
- Never mix display and body faces inside one sentence.
- Eyebrows are body face, uppercase, `0.12em` tracking — they are data, not voice.
- Stat numerals use `.rb-numeric` (display face, `tabular-nums`) so values do not
  jitter as they change.

| Class | Size | Use |
| --- | --- | --- |
| `.rb-display-xl` | `clamp(2.5rem, 6vw, 4.25rem)` | Hero |
| `.rb-display-lg` | `clamp(2rem, 4.2vw, 3rem)` | Section heads |
| `.rb-display-md` | `clamp(1.5rem, 2.6vw, 2rem)` | Card titles |
| `.rb-display-sm` | `1.25rem` | Sub-heads, list items |
| `.rb-body-lg` / `.rb-body` | `1.125rem` / `1rem` | Copy, `1.6` leading |
| `.rb-eyebrow` | `0.75rem` | Section labels |

### Shape & spacing

8px scale (`--rb-s1` … `--rb-s12`). Card radius **24px** (`rounded-rb-card`),
tile radius **16px**, buttons **fully rounded** (`rounded-rb-pill`).

### Component states

**`.rb-btn`** — 56px tall (`-lg` 64, `-sm` 44), pill, `0 4px 0` lip.

| State | Behaviour |
| --- | --- |
| Hover | `brightness(1.06)` |
| **Active** | `translateY(4px)` + lip removed — the button compresses into its own shadow |
| Focus | 3px Macaw outline, 3px offset |
| Disabled | Swan face, Hare ink, no lip, `not-allowed` |

Variants set face + lip only; geometry is shared: `mask`, `macaw`, `beetle`,
`fox`, `cardinal`, `ghost` (outlined, still travels), `snow` (for saturated
blocks).

**`.rb-answer`** — the core learning control. 64px min height, key cap (a/b/c/d),
states `idle` / `selected` / `correct` / `wrong`. State changes colour only —
**the box never resizes**, so feedback never shifts layout under a finger.

**`.rb-card`** — Snow, 2px Swan border, 24px radius. `.rb-card-raised` adds the
lip; `.rb-card-press` makes it travel like a key.

**`.rb-progress`** — 16px track, Mask fill, 600ms ease. The inner sheen line is
what separates a filling bar from a static one.

**`.rb-input`** — 56px, Polar fill → Snow on focus, Macaw focus border,
Cardinal + wash when `aria-invalid`.

### Motion

`rb-pop-in` (overshoot entry), `rb-rise` (feedback bars entering from below),
`rb-flicker` (streak flame only — never decorative). All animation is disabled
under `prefers-reduced-motion` by a blanket rule at the foot of the stylesheet.

---

## 2. Landing & Learner Dashboard

### Landing — built

Sticky 80px nav → hero → how it works → certifications → roadmap → AI tutor →
streaks & mastery → community → team → get access → footer.

**The signature is the hero.** It shows the actual desktop workspace learners sit
assessments in — a window frame containing the question navigator, and alternating
between the two question types that genuinely need the width:

- **Programming** — a code editor with line numbers, hand-tokenised Python, a
  blinking caret, and a live test runner showing 3 of 4 cases passing.
- **Diagram** — an ER canvas with entity cards, crow's-foot connectors, selection
  handles on the entity being edited, and a shape palette.

A live exam clock counts down in the chrome. The two tabs cross-fade every six
seconds; reduced motion holds the programming tab and stops the clock. The frame
is `aria-hidden` with an `sr-only` equivalent, since none of it is operable.

This is the thesis: Rebyu is an assessment workspace, not a flashcard app. The
long code line scrolls inside its own container so the page never scrolls
horizontally at 390px.

Boldness is spent there and nowhere else. Every other section stays quiet: Snow
and Polar alternation, one accent wash per section, no gradient text, no floating
glass panels.

### Learner dashboard — to build

Route `/learner`. Two columns at `lg`, single column below.

```
┌──────────────────────────────────────────────┬──────────────────┐
│ continue learning        [ Feather, full-w ] │  daily goal      │
│ TOPCIT · Operating Systems · lesson 4 of 9   │  ◐ 3/5 lessons   │
│ [========------] 62%   [ resume lesson → ]   │                  │
├──────────────────────────────────────────────┤  streak          │
│ certification readiness                      │  🔥 14 days      │
│   72%  ◜◝ radial, Feather track              │  m t w t f s s   │
│   "on track for the October sitting"         │                  │
├──────────────────────────────────────────────┤  ai tutor        │
│ weak topics            (Cardinal → Feather)  │  Beetle card     │
│  Normalization      38% [===-------]         │  "ask about      │
│  Subnetting         44% [====------]         │   anything"      │
│  Process scheduling 51% [=====-----]         │  [ ask → ]       │
├──────────────────────────────────────────────┼──────────────────┤
│ study calendar — 5 week heatmap, Fox scale   │  mastery points  │
└──────────────────────────────────────────────┴──────────────────┘
```

- **Continue Learning** is the single Feather primary on the page. Everything
  else is ghost or a card. One green button per screen keeps it meaningful.
- **Readiness** is a radial on a Swan track, Feather fill, with a plain-language
  verdict underneath. A number without a verdict makes people anxious; the
  verdict is the anxiety-reducing part.
- **Weak topics** grade Cardinal → Fox → Mask by mastery. Each row links straight
  into the lesson — a weakness the learner cannot act on is just bad news. This
  comes from the BKT mastery service, not the AI tutor.
- **Study calendar** is a 5-week heatmap on the Fox ramp. Missed days are Polar,
  never Cardinal: the calendar reports, it does not scold.

### App navigation (80px sticky)

Logo · **Learn · Certifications · AI Lab · Leaderboard · Community** · then
notifications bell, profile avatar, and a Feather **Continue Learning** button.
Active link gets a 4px Feather underline. Below `lg`, centre links collapse into
a bottom tab bar (Learn / Practice / AI / Community / Profile) with 56px targets.

The landing page uses a marketing variant of the same 80px geometry — a logged-out
visitor has no notifications, profile, or lesson to continue.

---

## 3. Certification Roadmap — built on landing, extend to `/learner/roadmap`

Ten fixed units: foundation → computer architecture → programming → operating
systems → networks → security → databases → software engineering → mock exam →
certification ready.

Rendered as a **winding learning path** — circular tactile nodes zig-zagging down
a single column under a unit banner. (This supersedes the earlier "curriculum
spine, not a game map" direction; the path was chosen deliberately because the
one-decision-at-a-time reading is what makes the habit stick.)

**Unit banner** — Feather fill, 5px lip, unit number + `n of 10` + lowercase
domain name, with a guidebook button split off by a Snow/25 divider on the right.
A dashed Swan card at the foot of the path names the next, locked unit.

**Nodes** — `.rb-node`, 72px circles with an **8px** lip (deeper than buttons, so
they read as chunky keys) and a soft top-highlight that stops them looking like
flat discs. Positioned on a sine curve, `sin(index * 0.85) * 84px`, which keeps
the whole path inside a 390px column without horizontal scroll.

| Node kind | Icon | Colour |
| --- | --- | --- |
| Lesson | Star (Check once done) | Feather |
| Code task | Code2 | Macaw |
| Diagram task | Network | Beetle |
| Chest | Gift | **Bee, even when locked** |
| Review | RotateCw | Feather |
| Unit test | Trophy | Feather |
| Any locked | Lock | Swan, no highlight, `not-allowed` |

Two deliberate rules:

- **Chests keep their gold while locked.** The reward is what pulls a learner
  down the path; greying it out defeats the point. Everything else locked goes
  Swan and loses its top-highlight, so it reads inert rather than merely dim.
- **The active node is the only thing moving.** It carries a Feather progress
  ring (SVG, `stroke-dashoffset`) and a bobbing "start here" bubble. One target,
  no ambiguity about where to click.

No mascot. The reference art is Duolingo's; the path structure is the borrowed
idea, the character is not.

Full-page version adds: per-node lesson count, an exam-date countdown pinned
below the final unit, and scroll-to-active on mount.

---

### AI tutor — scope

The tutor does exactly three things, and the UI must not imply more:

1. Explains a concept **while the learner is studying a lesson**.
2. Generates a **quiz** from that lesson.
3. Generates a **flashcard deck** from that lesson.

It does not analyse weaknesses, rank topics, read a mistake bank, mark diagrams,
or grade code — those belong to BKT, the assessment engine, and the analytics
surfaces. Keep tutor copy anchored to the current lesson, and keep its two
actions phrased as `make a quiz` and `make flashcards`.

Tutor surfaces use Beetle. Analytics and BKT-derived surfaces use Macaw. Keeping
those two colours distinct is what stops the tutor from *looking* like it owns
the weakness data.

---

## 4. Lesson Viewer & Practice Suite

Route `/learner/lesson/:id`. Three columns at `xl`.

```
┌──────────┬─────────────────────────────────┬──────────────┐
│ roadmap  │  lesson content                 │  ai tutor    │
│ (rail)   │                                 │  (sticky)    │
│          │  ┌───────────────────────────┐  │              │
│ ✓ found. │  │ Which normal form removes │  │ Beetle head  │
│ ✓ arch.  │  │ partial dependency?       │  │              │
│ ● os  ◀  │  │                           │  │ chat thread  │
│   ├ 1 ✓  │  │ [a] 1NF                   │  │ (this lesson │
│   ├ 2 ✓  │  │ [b] 2NF        ← correct  │  │  only)       │
│   ├ 3 ●  │  │ [c] 3NF                   │  │              │
│   └ 4 ○  │  │ [d] BCNF                  │  │ [make a quiz]│
│ 🔒 net.  │  └───────────────────────────┘  │ [make cards ]│
│ 🔒 sec.  │  ┌───────────────────────────┐  │              │
│          │  │ ✓ nice — that's the one   │  │ [ ask → ]    │
│          │  │   [ continue → ] Feather  │  │              │
└──────────┴──┴───────────────────────────┴──┴──────────────┘
   240px              flexible, max 720px       320px
```

The tutor rail is scoped to the lesson on screen. Its only two generative
actions are `make a quiz` and `make flashcards` — both produce content from the
current lesson. It never surfaces cross-lesson weakness claims.

**Interaction contract**

1. Options render `idle`. Selecting sets `selected` (Macaw) — nothing is graded yet.
2. **Check** grades it. Correct → Feather; wrong → Cardinal *and* the right answer
   turns Feather simultaneously. Never reveal a mistake without the correction.
3. The feedback bar `rb-rise`s from the bottom of the viewport and owns the
   Continue button. Continue lands in the same place every time, so the loop
   becomes muscle memory.
4. Wrong answers drop into the mistake bank and re-queue later in the set.

The answer box never resizes between states — grading must not move the target
under the user's finger.

**Flashcards:** 3D flip on a 24px card, `rotateY` 400ms. Three tactile responses,
not a grade: `again` (Cardinal) · `hard` (Fox) · `got it` (Feather).

Below `xl` the rail becomes a top progress bar and the tutor becomes a Beetle FAB
that opens a sheet.

---

## 5. Mock Exam Environment

Route `/learner/mock/:id`. Deliberately the **calmest surface in the product** —
gamification is suppressed. No streak, no points, no confetti. Exams are the
stressful moment; the UI should lower the temperature, not raise it.

**Header** — Humpback, not Feather.

```
 REBYU mock  ·  TOPCIT           Q 14/80        ⏱ 01:12:44        [ end exam ]
```

The timer is Eel and tabular. It turns Fox at 10 minutes and Cardinal at 2, and
that is the only colour escalation in the module. It never pulses or shakes.

**Navigator** — an 80-cell grid, right rail on desktop, sheet on mobile.

| Cell | Meaning |
| --- | --- |
| Polar | unseen |
| Macaw | answered |
| Bee ring | flagged for review |
| Swan outline | current |

**Review mode** — before submit, a summary of unanswered and flagged counts, then
a confirm dialog. Submission is irreversible and reads that way.

**Results** — the one place the module warms up.

- Score ring against the passing mark, with the mark drawn as a Swan tick on the
  track so pass/fail is spatial, not just numeric.
- **Passing prediction:** a Feather / Fox / Cardinal band with a plain sentence —
  "You are scoring above the mark. Keep the streak and sit it in October."
- Per-domain breakdown, sorted weakest first, each row linking back to its lesson.
- Timing analysis: seconds per question against the pace needed to finish.

---

## 6. Dashboard Widgets & Gamification

Composable cards, all built on `RebyuCard` + `ProgressBar` + `StatTile`.

| Widget | Colour | Notes |
| --- | --- | --- |
| Study streak | Fox | Flame with `rb-flicker`, 7-day row, longest-streak chip. Missed days are Polar, never Cardinal. |
| Mastery points | Bee | `rb-numeric`, `rb-pop-in` on increment |
| Weekly challenge | Bee | `6/10` + bar + what remains, stated concretely |
| Domain completion | Macaw | `3 of 8` + bar |
| Exam readiness | Feather | Radial + verdict sentence |
| Consistency | Fox | 5-week heatmap |
| Leaderboard | Humpback | Rank, delta arrow, avatar; the learner's own row is Feather-tinted and pinned |

**Rules**

- Rewards use Bee, streaks use Fox, mastery uses Feather. Not interchangeable.
- Never Cardinal for a missed day or a broken streak. Cardinal is for wrong
  answers and destructive actions only; punishing absence drives people away.
- Celebration is `rb-pop-in` on the number that changed, not a full-screen takeover.

---

## 7. Supporting Views & Responsive

**Auth** — single centred `rb-card`, max 440px, `rb-input` fields, one Feather
`rb-btn` full-width. Errors are Cardinal, inline under the field, and say what to
do next rather than only what failed.

**Profile** — Feather cover band, avatar overlapping at `-40px`, then earned
badges (Bee), certification tracks, and lifetime stats.

**Settings** — left nav + panel at `lg`, accordion below. Grouped Account /
Learning / Notifications / Billing. Destructive actions sit in their own
Cardinal-bordered card at the foot, never inline with ordinary settings.

**Notifications** — grouped Today / This week / Earlier. Unread rows carry a 4px
Feather left border and a Polar fill. Type icons: Bee achievement, Fox streak,
Macaw AI, Humpback system.

### Breakpoints

| | Width | Layout |
| --- | --- | --- |
| `sm` | 390–639 | Single column, bottom tab bar, sheets replace rails |
| `md` | 640–1023 | Two-column cards, rails still collapsed |
| `lg` | 1024–1279 | Sidebar returns, top nav expands |
| `xl` | 1280+ | Full three-column lesson viewer |

**390px rules** — 20px gutters; buttons full-width and stacked; the lesson rail
becomes a top progress bar; the AI tutor becomes a Beetle FAB; the exam navigator
becomes a bottom sheet; display type clamps to 40px.

Verified on the landing page at 390px: no horizontal overflow, all interactive
targets ≥44px, footer links ≥24px.

---

## Accessibility

Measured against the mandated palette:

| Pair | Ratio | AA normal (4.5) | AA large (3.0) |
| --- | --- | --- | --- |
| Eel on Snow | 8.72 | pass | pass |
| Eel on Polar | 8.14 | pass | pass |
| `#3d6b06` on Feather wash | 5.95 | pass | pass |
| Wolf on Snow | 4.48 | **marginal** | pass |
| Wolf on Polar | 4.18 | **fail** | pass |
| Snow on Cardinal | 3.30 | fail | pass |
| Snow on Macaw | 2.44 | fail | fail |
| **Snow on Feather** | **2.09** | **fail** | **fail** |

White-on-Feather at 2.09:1 is the significant one, and it is inherent to the
brief's palette — these are the values Duolingo itself ships. The defaults are
left as specified rather than silently altered.

`.rb-a11y` is the opt-in remedy: adding it beside `rebyu-ds` darkens Feather to
`#3F8F02`, Macaw to `#0D7FB8`, Cardinal to `#D62C2C`, and Wolf to `#5F5F5F`.
Only colour changes — geometry, depth, and motion are identical. It clears AA for
large text throughout and pulls body copy back over 4.5:1.

Independent of that choice, the system already guarantees:

- Focus is visible everywhere — 3px Macaw outline at 3px offset, never removed.
- State is never colour-only: correct/wrong carry check and cross icons, locked
  milestones carry a lock, flagged questions carry a ring.
- `prefers-reduced-motion` disables all animation, and the hero demo stops
  autoplaying rather than merely animating faster.
- Progress bars expose `role="progressbar"` with `aria-valuenow` and a label.
- The decorative hero demo is `aria-hidden` with an `sr-only` description.
