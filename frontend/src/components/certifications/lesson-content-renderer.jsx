import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { fetchFileBlob, getFileViewUrl } from "@/services/fileService.js"
import { parseLessonStructure } from "@/services/learnerService.js"
import { Maximize, RotateCcw } from "@/components/icons"
import { Card } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

// Shared, presentational lesson-body renderer -- extracted verbatim from
// the learner lesson page so the institution content viewer renders lessons
// identically. Pure: takes a block (tool) or a structure string, no data
// fetching, no progress/completion concerns.
//
// Blocks here use the shadcn semantic tokens (`border-border`,
// `text-foreground`, `bg-card`, `text-primary`, ...) rather than hardcoded
// zinc hex values, on purpose: this renderer runs both inside the learner
// portal's `.rebyu-ds` scope and outside it in the institution content viewer.
//
// The `rb-*` design-system *utilities* are equally safe in both, contrary to
// what this note used to claim: they are declared in an `@theme` block, so
// Tailwind emits their variables on `:root`, and `bg-rb-snow` /
// `border-rb-swan` / `rounded-rb-card` / `font-rb-display` measure identically
// in and out of the scope. What is genuinely scoped is the *component* layer
// -- `.rb-chip`, `.rb-btn`, `.rb-card`, `.rb-display` -- which goes inert
// outside `.rebyu-ds` (transparent, `display: block`). Never reach for those
// here; the utilities are fine, and the accordion and tabs blocks use them to
// borrow the certification surfaces' card language.

const EASE = [0.22, 1, 0.36, 1]

// Chart tokens rather than the `.rebyu-ds` palette: they're plain `:root`
// variables (see index.css), so they resolve identically in the institution
// content viewer, which renders this file outside the `.rebyu-ds` scope.
// Order alternates warm/cool so consecutive blocks never land on adjacent hues.
// `!`-important: these get merged onto shadcn `Card`/list/heading base classes
// that already set a border/text/bg color (e.g. `border-border/70`), and
// `twMerge` doesn't know our custom `chart-*` theme colors well enough to drop
// the base class for us -- without `!` the two land in the cascade and the
// base one (registered later in Tailwind's generated stylesheet) wins.
const ACCENTS = [
  { text: "!text-chart-1", marker: "marker:!text-chart-1", border: "!border-chart-1", bgSolid: "!bg-chart-1", bgSoft: "!bg-chart-1/10" },
  { text: "!text-chart-5", marker: "marker:!text-chart-5", border: "!border-chart-5", bgSolid: "!bg-chart-5", bgSoft: "!bg-chart-5/10" },
  { text: "!text-chart-2", marker: "marker:!text-chart-2", border: "!border-chart-2", bgSolid: "!bg-chart-2", bgSoft: "!bg-chart-2/10" },
  { text: "!text-chart-4", marker: "marker:!text-chart-4", border: "!border-chart-4", bgSolid: "!bg-chart-4", bgSoft: "!bg-chart-4/10" },
  { text: "!text-chart-3", marker: "marker:!text-chart-3", border: "!border-chart-3", bgSolid: "!bg-chart-3", bgSoft: "!bg-chart-3/10" },
]

function accentFor(index) {
  return ACCENTS[((index % ACCENTS.length) + ACCENTS.length) % ACCENTS.length]
}

/**
 * The certification surfaces' accent pairs, for the blocks that borrow their
 * card language (accordion, tabs) rather than the chart palette above.
 *
 * Safe outside `.rebyu-ds` despite the note at the top of this file: the
 * `rb-*` *utilities* come from an `@theme` block, so Tailwind emits their
 * variables on `:root` and they resolve identically in the institution viewer
 * (verified: same 24px radius, same #e5e5e5 border in and out of scope). It is
 * the `.rb-chip` / `.rb-btn` *component classes* that are scoped and go inert
 * outside it -- those are still off limits here.
 *
 * `data-active:` variants are spelled out in full rather than composed at the
 * call site, because Tailwind scans source text: a class assembled as
 * `data-active:${x}` is invisible to it and never gets generated.
 *
 * Ink shades on bee and feather are the AA-tuned `-ink` values, not the `-lip`
 * button-shadow ones, since this text sits on a wash.
 */
const RB_ACCENTS = [
  { chip: "bg-rb-macaw-wash text-rb-macaw-lip", wash: "bg-rb-macaw-wash" },
  { chip: "bg-rb-fox-wash text-rb-fox-lip", wash: "bg-rb-fox-wash" },
  { chip: "bg-rb-bee-wash text-rb-bee-ink", wash: "bg-rb-bee-wash" },
  { chip: "bg-rb-beetle-wash text-rb-beetle-lip", wash: "bg-rb-beetle-wash" },
  { chip: "bg-rb-feather-wash text-rb-feather-ink", wash: "bg-rb-feather-wash" },
]

/**
 * The selected tab: one solid Feather pill, not a per-accent tint.
 *
 * The accent washes this used to reach for measure 1.10-1.14:1 against the
 * Snow pill they sit on -- a difference you cannot see, which is why every tab
 * looked white whichever was open. Filling solid instead of tinting is the
 * only way the state reads at a glance.
 *
 * Feather rather than the tab's own accent because white on solid clears AA
 * (4.5:1) for almost none of them -- Macaw 2.44, Fox 2.18, Bee 2.38, Beetle
 * 2.54, Cardinal 3.30. Feather is 4.59 and is already this system's primary
 * action colour, so selection looks like every other chosen thing in the
 * product. The per-accent identity is not lost, it just lives where it can be
 * seen: the panel's number tile and washed body still cycle.
 */
const RB_PILL_ACTIVE =
  "data-active:border-rb-feather data-active:bg-rb-feather data-active:text-white"

function rbAccentFor(index) {
  return RB_ACCENTS[((index % RB_ACCENTS.length) + RB_ACCENTS.length) % RB_ACCENTS.length]
}

/* The certification card, as one string: a Snow panel with the system's
   2px Swan border and 24px corner. Shared by both blocks below so an
   accordion row and a tab panel are visibly the same object. */
const RB_CARD = "overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow"

/* The numbered tile that opens a middle-category row. */
const RB_INDEX_CHIP =
  "grid size-11 shrink-0 place-items-center rounded-2xl font-rb-display text-base font-extrabold"

/**
 * AI-generated lessons store either a plain search-result URL (image or
 * YouTube link) or an admin-uploaded internal storage key in the same
 * `imageKey`/`videoKey` field. Routing an absolute URL through
 * `getFileViewUrl` mangles it into `/files/view?key=https://...`, which the
 * file endpoint rejects -- that's what rendered as a broken image / blank
 * video. Absolute URLs are used as-is; anything else is treated as a key.
 *
 * A root-relative path is the third case: diagrams we draw ourselves and ship
 * in `public/`. They are not storage keys and must not be signed -- and unlike
 * the hotlinked search results, they cannot rot or 403 when the host that owns
 * them decides it dislikes being embedded.
 */
function resolveMediaSrc(key) {
  if (!key) return ""
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key
  }
  if (key.startsWith("/")) {
    return key
  }
  return getFileViewUrl(key)
}

/**
 * Credits the page an AI-sourced image came from. Absent for admin-uploaded
 * images (no `imageSourceUrl` in that case) since there's nothing external to
 * credit -- the file is the admin's own upload, not something pulled off the
 * web that needs attribution.
 */
function ImageAttribution({ sourceUrl, sourceName }) {
  if (!sourceUrl) return null

  let label = sourceName
  if (!label) {
    try {
      label = new URL(sourceUrl).hostname.replace(/^www\./, "")
    } catch {
      label = sourceUrl
    }
  }

  return (
      <p className="mt-1.5 text-xs text-muted-foreground">
        Source:{" "}
        <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {label}
        </a>
      </p>
  )
}

/**
 * One fixed box for every lightbox, image and video alike.
 *
 * The first version sized the panel to the picture (`w-auto` up to 95vw/90vh),
 * which meant the viewer's size was decided by whatever the AI happened to
 * source: a wide org chart took the entire screen while a smaller one opened
 * barely larger than it had been in the lesson. Opening two diagrams in a row
 * looked like two different features.
 *
 * A fixed panel with `object-contain` inside makes every image land in the same
 * place at the same size, letterboxing where the aspect does not match -- the
 * same reasoning the lesson body already applies to its inline media box, just
 * at viewer scale. Capped at 1000px rather than the viewport so it reads as a
 * focused viewer rather than a full-screen takeover.
 */
//: `p-6` is the gap between the picture and the panel edge. It has to be
//: explicit and generous because the media is `h-full w-full`: it fills the
//: content box exactly, so the padding is the *only* thing separating it from
//: the frame. At `p-4` against an image with a pale background of its own the
//: two read as one edge-to-edge block with no frame at all.
//:
//: The panel keeps DialogContent's own surface -- `bg-popover`, border, rounded
//: corners, shadow. An earlier version stripped all three to `bg-transparent`,
//: which looked right only for an image that happened to fill the box exactly:
//: `object-contain` letterboxes everything else, and with no background those
//: bands showed the dimmed lesson page straight through. An image with its own
//: alpha channel washed out against it too. A viewer needs a surface to sit on.
//:
//: `place-items-center` because DialogContent is a grid: its only in-flow child
//: is the media (the title and close control are `sr-only`, so absolutely
//: positioned and out of flow), and centring it explicitly avoids depending on
//: how a stretched item resolves `h-full` inside an auto-sized row.
//: `!max-w-none` is important-flagged to beat the base `sm:max-w-lg` -- that is
//: a different variant group, so tailwind-merge does not treat it as a conflict
//: and would otherwise leave it applied above 640px.
const LIGHTBOX_PANEL =
    "!max-w-none w-[min(92vw,1000px)] h-[min(78vh,660px)] grid place-items-center overflow-hidden p-6"

//: The media is capped in the SAME units as the panel, minus its `p-6` on both
//: sides (1.5rem x 2 = 3rem) -- not in percentages of it.
//:
//: `h-full w-full` was the obvious spelling and it silently failed. The panel's
//: single grid row is auto-sized, so the browser sizes the row from its content
//: while the content asks for 100% of the row: a cycle. The percentage resolves
//: to `auto`, the row grows to the image's intrinsic height -- 1200px for a
//: lesson diagram -- and the picture spills straight out of a panel fixed at
//: 660px, uncropped, over the page behind it. It only looked correct for images
//: that happened to be smaller than the panel already.
//:
//: Absolute caps have no such cycle: the image is never asked how big it is in
//: terms of a box whose size depends on the answer. `overflow-hidden` on the
//: panel above is the backstop -- if any future image escapes its cap, it is
//: clipped to the frame instead of covering the lesson.
const LIGHTBOX_MEDIA =
    "max-h-[calc(min(78vh,660px)-3rem)] max-w-[calc(min(92vw,1000px)-3rem)] object-contain"

/**
 * A lesson image, openable full-screen.
 *
 * Every image block sizes its picture to a fixed box (`aspect-video` and
 * `object-contain`) so a run of them reads as one column rather than a ragged
 * stack. That is right for the page and wrong for the picture: lesson images
 * are mostly diagrams, and a diagram letterboxed into a 16:9 slot on a laptop
 * renders its labels too small to read. This is the way out -- the layout keeps
 * its uniform box, and the learner can open the image at its own size.
 *
 * The lightbox is per-image local state rather than one shared viewer. The
 * renderer has two entry points -- `LessonContent` for a whole lesson and
 * `LessonTool` for a single block (the topic page and the admin preview both
 * use the latter) -- so a viewer hoisted to the top would exist for one and not
 * the other. A closed Dialog renders nothing, so the cost of one per image is
 * a boolean.
 */
function LessonImage({ imageKey, alt = "", className, sourceUrl, sourceName }) {
  const [open, setOpen] = useState(false)
  // Not `resolveMediaSrc`: an admin-uploaded key points at the authenticated
  // `/files/view`, which an <img> cannot load on its own. See
  // {@link useAuthedMediaSrc}.
  const src = useAuthedMediaSrc(imageKey)

  // The image box is held at its final size while the fetch is in flight, so
  // the surrounding copy does not reflow when it lands. `className` carries the
  // block's own sizing (`aspect-video w-full`, `min-h-72`, ...), so reusing it
  // here keeps the placeholder exactly the shape of what replaces it.
  if (imageKey && !src) {
    return (
        <div
            className={`${className} !border-dashed motion-safe:animate-pulse`}
            aria-label={alt ? `Loading ${alt}` : "Loading image"}
            role="img"
        />
    )
  }

  return (
      <div>
        {/* A button, not an `onClick` on the img: this has to be reachable by
            keyboard and announce itself to a screen reader, and only a real
            control does both for free. `cursor-zoom-in` is the affordance --
            without it nothing on the page suggests the image opens. */}
        <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={alt ? `View "${alt}" full size` : "View image full size"}
            className="group relative block w-full cursor-zoom-in rounded-[var(--radius-rb-tile)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <img src={src} alt={alt} className={className} />
          <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[var(--radius-rb-tile)] bg-foreground/0 transition-colors group-hover:bg-foreground/5"
          />
        </button>

        <ImageAttribution sourceUrl={sourceUrl} sourceName={sourceName} />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className={LIGHTBOX_PANEL}>
            <DialogTitle className="sr-only">{alt || "Lesson image"}</DialogTitle>
            <img src={src} alt={alt} className={LIGHTBOX_MEDIA} />
          </DialogContent>
        </Dialog>
      </div>
  )
}

function getYouTubeEmbedUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`
    }
    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v")
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
  } catch {
    return null
  }
  return null
}

/** Renders a video key as a native player, or an iframe embed for YouTube links. */
/**
 * A lesson video, openable full-screen -- the same affordance as
 * {@link LessonImage}, reached a different way.
 *
 * A video cannot use the image's click-anywhere gesture: both players own
 * their surface. A click on the YouTube iframe belongs to YouTube, and a click
 * on `<video controls>` is play/pause. So the way in is an explicit control in
 * the corner instead, which is also why it carries an icon and a label where
 * the image needs neither.
 *
 * The inline player is UNMOUNTED while the lightbox is open. Leaving it
 * mounted means two copies of the same video exist at once, and if the learner
 * had it playing when they expanded, its audio keeps going behind the overlay
 * with no visible way to stop it. The cost is that playback restarts from the
 * beginning in the lightbox -- the right trade against two soundtracks at once.
 */
function VideoBlock({ videoKey, className }) {
  const [expanded, setExpanded] = useState(false)
  const src = resolveMediaSrc(videoKey)
  if (!src) return null

  const embedUrl = getYouTubeEmbedUrl(src)
  const player = (playerClassName) =>
      embedUrl ? (
          <iframe
              src={embedUrl}
              title="Lesson video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className={playerClassName}
          />
      ) : (
          <video controls className={playerClassName} src={src} />
      )

  return (
      <div className="relative">
        {expanded ? (
            <div
                className={`${className} grid place-items-center text-sm text-muted-foreground`}
                aria-hidden="true"
            >
              Playing full size
            </div>
        ) : (
            player(className)
        )}

        <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="View video full size"
            className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border-2 border-border/70 bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Maximize className="size-4" />
        </button>

        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className={LIGHTBOX_PANEL}>
            <DialogTitle className="sr-only">Lesson video</DialogTitle>
            {player(`${LIGHTBOX_MEDIA} rounded-[var(--radius-rb-tile)] bg-foreground`)}
          </DialogContent>
        </Dialog>
      </div>
  )
}

function renderText(text, className) {
  return String(text ?? "")
      .split("\n")
      .filter(Boolean)
      .map((line, index) => (
          <p key={`${line}-${index}`} className={className}>
            {line}
          </p>
      ))
}

function SectionIntro({ smallHeader, description, accent = ACCENTS[0] }) {
  if (!smallHeader && !description) return null

  return (
      <div>
        {smallHeader ? (
            <p className={`text-sm font-semibold uppercase tracking-wide ${accent.text}`}>
              {smallHeader}
            </p>
        ) : null}
        {renderText(description, "mt-2 text-base leading-8 text-muted-foreground")}
      </div>
  )
}

/**
 * Accordion body, wearing the certification curriculum's middle-category row:
 * a Snow card per item, numbered accent tile, display-face title, and a washed
 * body behind a 2px rule. A learner meets that row when they pick a topic, so
 * a collapsible inside the lesson that opens the same way is one pattern
 * learned once rather than two that merely resemble each other.
 *
 * Still the Radix primitive underneath, restyled rather than hand-rolled --
 * the curriculum's own row hand-rolls its toggle and gets no `aria-controls`
 * or managed region for it. Borrowing the look should not cost the semantics.
 */
function AccordionBlock({ items = [] }) {
  if (items.length === 0) return null

  return (
      // gap-3, not a divider: each item is its own card now, the way the
      // curriculum stacks its topic rows.
      <Accordion type="single" collapsible defaultValue={String(items[0]?.id ?? 0)} className="gap-3">
        {items.map((item, index) => {
          const id = String(item.id ?? index)
          const rb = rbAccentFor(index)

          return (
              // `not-last:border-b-2` restates the base's `not-last:border-b`
              // at this card's weight -- left alone it would thin every
              // non-final card's bottom edge to 1px against its other three.
              <AccordionItem key={id} value={id} className={`${RB_CARD} not-last:border-b-2`}>
                <AccordionTrigger className="items-center gap-3 p-4 hover:no-underline">
                  <span className={`${RB_INDEX_CHIP} ${rb.chip}`} aria-hidden="true">
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1 font-rb-display text-base font-extrabold text-rb-eel">
                    {item.title}
                  </span>
                </AccordionTrigger>

                {/* `content` or `description`: the admin builder writes an
                    accordion item's body to `content`, but the generator has
                    been writing it to `description`, so every AI-authored
                    accordion rendered as a stack of titles with nothing under
                    them. The generator is fixed to emit `content` too, but
                    every lesson already sitting in the database still carries
                    `description` -- reading both is what makes those render
                    without a migration. */}
                <AccordionContent
                    className={`border-t-2 border-rb-swan px-4 py-3 text-[15px] leading-7 text-rb-wolf ${rb.wash}`}
                >
                  {item.content ?? item.description}
                </AccordionContent>
              </AccordionItem>
          )
        })}
      </Accordion>
  )
}

/**
 * Tabs in the same language: the triggers are the rounded topic pills a unit
 * card lists its middle categories with, and the panel below is the same
 * card the accordion above uses -- numbered tile, display-face title, washed
 * body. Picking a tab should feel like picking a topic.
 */
function TabsBlock({ items = [] }) {
  if (items.length === 0) return null

  return (
      <Tabs defaultValue="0" className="gap-0">
        {/* `group-data-horizontal/tabs:h-auto`, not a bare `h-auto`: the list's
            fixed 12rem-tall rule is set behind that same variant, and a
            different variant chain is a separate utility to tailwind-merge --
            an unprefixed height simply loses to it. The underline border goes
            for the same reason the pills arrived: this is a row of chips, not
            a tab strip. */}
        <TabsList className="w-full flex-wrap gap-2 border-b-0 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
          {items.map((item, index) => {
            return (
                <TabsTrigger
                    key={item.id ?? item.label ?? index}
                    value={String(index)}
                    // `flex-1` is the primitive's own behaviour, kept: the
                    // triggers share the list's full width, so the strip ends
                    // flush with the panel below it. Overriding it to
                    // `flex-none` left the pills sized to their labels and a
                    // gap of dead space after the last one.
                    //
                    // `after:hidden` kills the primitive's active-underline
                    // outright -- it is driven by opacity, so dimming it would
                    // leave the bar in the layout under a pill that already
                    // shows its state by filling.
                    className={`h-auto flex-1 rounded-rb-pill border-2 border-rb-swan bg-rb-snow px-3.5 py-2 text-sm font-bold text-rb-wolf after:hidden ${RB_PILL_ACTIVE}`}
                >
                  {item.label ?? item.title ?? `Tab ${index + 1}`}
                </TabsTrigger>
            )
          })}
        </TabsList>

        {items.map((item, index) => {
          const rb = rbAccentFor(index)

          return (
              <TabsContent
                  key={item.id ?? item.label ?? index}
                  value={String(index)}
                  className={`mt-3 ${RB_CARD}`}
              >
                <div className="flex items-center gap-3 p-4">
                  <span className={`${RB_INDEX_CHIP} ${rb.chip}`} aria-hidden="true">
                    {index + 1}
                  </span>

                  {/* Title only. A topic row carries a summary under its name,
                      but the only thing this block has to put there is the
                      label -- which is the pill you just pressed, sitting a few
                      pixels above. Restating it read as a stutter ("Use Cases /
                      Use Case Specifications / Use Cases"), so the row is one
                      line here. Falls back to the label when an item has no
                      title of its own, rather than rendering an empty heading. */}
                  <span className="min-w-0 flex-1 font-rb-display text-base font-extrabold text-rb-eel">
                    {item.title ?? item.label}
                  </span>
                </div>

                <div
                    className={`border-t-2 border-rb-swan px-4 py-3 text-[15px] leading-7 text-rb-wolf ${rb.wash}`}
                >
                  {item.description}
                </div>
              </TabsContent>
          )
        })}
      </Tabs>
  )
}

/** A card that flips on click to reveal its back face. Fixed height so every
 * card in a grid lines up regardless of which side (front/back) is showing. */
function FlipCard({ frontTitle, backTitle, description, accent = ACCENTS[0] }) {
  const [flipped, setFlipped] = useState(false)

  return (
      <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label={`${frontTitle}. Press to ${flipped ? "show front" : "reveal detail"}.`}
          className="group block h-48 w-full text-left [perspective:1200px]"
      >
        <motion.div
            className="relative h-full w-full [transform-style:preserve-3d]"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: EASE }}
        >
          {/* Front */}
          <Card className={`absolute inset-0 h-full justify-between !border-t-4 p-5 [backface-visibility:hidden] ${accent.border}`}>
            <p className="font-heading font-semibold text-foreground">{frontTitle}</p>
            <span className={`inline-flex size-7 items-center justify-center self-start rounded-full transition group-hover:opacity-80 ${accent.bgSoft} ${accent.text}`}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </span>
          </Card>

          {/* Back */}
          <Card
              className={`absolute inset-0 h-full justify-center p-5 shadow-[0_2px_0_currentColor] [backface-visibility:hidden] ${accent.border} ${accent.bgSoft} ${accent.text}`}
              style={{ transform: "rotateY(180deg)" }}
          >
            {/* The front's title, not `backTitle`. The generator tends to fill
                backTitle with a generic label ("The Problem"), so flipping a
                card replaced the one thing identifying it with a word shared
                by every other card in the grid -- turn two over and you could
                no longer tell which was which. The card keeps its name; only
                the face changes. `backTitle` stays as the fallback for cards
                that carry no front title. */}
            <p className={`font-heading font-semibold ${accent.text}`}>
              {frontTitle ?? backTitle}
            </p>
            <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{description}</p>
          </Card>
        </motion.div>
      </button>
  )
}

/**
 * An image the learner explores by opening labelled points on it.
 *
 * The detail sits in a panel *below* the image rather than in a popover
 * anchored to the pin. A popover over a diagram covers the very thing the pin
 * is pointing at, and on a phone it either overflows the viewport or shrinks
 * to a few words -- both of which defeat the block. Below, the image stays
 * whole and the text has the full column width at any size.
 *
 * Pins are positioned in percentages (written by the authoring tool), so they
 * track their feature as the image box resizes. That only holds while the
 * rendered box has the image's own aspect ratio, which is why this block uses
 * `object-contain` on an `inline-block` wrapper that the image sizes itself --
 * not the fixed `aspect-video` box the plain image block uses. A letterboxed
 * image would leave the pins floating over the backing instead of the picture.
 */
/**
 * A media key as something an `<img>` can actually load.
 *
 * `resolveMediaSrc` is not enough on its own for an admin-uploaded file. It
 * points at `/files/view`, which calls `requireAuth`, and a browser attaches
 * no Authorization header to an `<img src>` -- so the request arrives
 * unauthenticated and comes back `400 Authentication is required`, rendering
 * as a broken image however correct the URL looks. The file has to be fetched
 * through `base()` (which does send the bearer token) and handed to the tag as
 * an object URL instead.
 *
 * AI-sourced images are stored as absolute URLs rather than storage keys, and
 * those are public, so they skip the fetch and are used as-is.
 */
function useAuthedMediaSrc(key) {
  const isAbsolute = Boolean(key) && /^https?:\/\//.test(key)
  const [blobSrc, setBlobSrc] = useState("")

  useEffect(() => {
    if (!key || isAbsolute) {
      setBlobSrc("")
      return
    }

    let cancelled = false
    let objectUrl = ""

    fetchFileBlob(key)
        .then((blob) => {
          if (cancelled) return
          objectUrl = URL.createObjectURL(blob)
          setBlobSrc(objectUrl)
        })
        .catch(() => {
          if (!cancelled) setBlobSrc("")
        })

    return () => {
      cancelled = true
      // Revoked on unmount and on every key change -- an object URL held for
      // the life of the tab is a leaked copy of the whole file.
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [key, isAbsolute])

  return isAbsolute ? key : blobSrc
}

function ImageHotspotBlock({ data, accent }) {
  const hotspots = Array.isArray(data.hotspots) ? data.hotspots : []
  const [openId, setOpenId] = useState(null)
  // Every pin the learner has opened at least once. The pulse is a "there is
  // something here" cue, so it has done its job the moment a pin is opened and
  // keeping it going afterwards is just motion nagging about content already
  // read. Tracked separately from `openId` because closing a pin must not make
  // it start pulsing again -- once all of them are opened, the image goes
  // still for good.
  const [visitedIds, setVisitedIds] = useState(() => new Set())

  const src = useAuthedMediaSrc(data.imageKey)

  function toggleHotspot(hotspotId, isOpen) {
    setOpenId(isOpen ? null : hotspotId)

    if (!isOpen) {
      setVisitedIds((previous) =>
          previous.has(hotspotId) ? previous : new Set(previous).add(hotspotId)
      )
    }
  }
  const openIndex = hotspots.findIndex((hotspot) => hotspot.id === openId)
  const openHotspot = openIndex === -1 ? null : hotspots[openIndex]

  // Keyed on the stored value, not on `src`: `src` is empty for the moment the
  // authenticated fetch is in flight, and returning null on that would blank a
  // block that is about to have an image.
  if (!data.imageKey) {
    return null
  }

  return (
      <div className="space-y-4">
        <SectionIntro smallHeader={data.smallHeader} description={data.description} accent={accent} />

        <div className="flex justify-center rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted p-2">
          {/* The pins are placed in percentages of this box, so they are only
              correct once the image has laid out. Held back until then rather
              than drawn over an empty box, where they would cluster in the
              corner and then jump. */}
          {!src ? (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-muted-foreground">
                Loading image...
              </div>
          ) : (
          <div className="relative inline-block max-w-full">
            <img
                src={src}
                alt={data.altText || "Lesson diagram with labelled points"}
                className="max-h-[560px] w-auto max-w-full rounded-[calc(var(--radius-rb-tile)-4px)]"
            />

            {hotspots.map((hotspot, hotspotIndex) => {
              const isOpen = hotspot.id === openId
              const isVisited = visitedIds.has(hotspot.id)

              return (
                  <button
                      key={hotspot.id ?? hotspotIndex}
                      type="button"
                      onClick={() => toggleHotspot(hotspot.id, isOpen)}
                      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                      aria-label={`Point ${hotspotIndex + 1}: ${hotspot.title}`}
                      aria-pressed={isOpen}
                      // `isolate` so the halo's negative z-index is contained
                      // by the pin and lands behind its own opaque background
                      // rather than behind the image.
                      className={`absolute isolate grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm font-bold shadow-md ring-2 ring-background transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                          isOpen
                              ? `scale-110 text-white ${accent.bgSolid}`
                              : "bg-foreground text-background"
                      }`}
                  >
                    {hotspotIndex + 1}

                    {/* An echo on the unopened pins. Without it they read as
                        numbers printed on the diagram and learners never
                        discover there is anything to open.

                        Two layers, not one. The static halo is the part that
                        always draws: it carries the affordance on its own, so
                        the block still works for a reader who has asked their
                        OS for less motion. The ping rides on top under
                        `motion-safe:`, which compiles to a
                        `prefers-reduced-motion: no-preference` query -- that
                        respondent gets the pulse, everyone else gets a pin
                        that is just as legible and holds still. Indefinite
                        auto-starting motion with no pause control is what
                        WCAG 2.2.2 is about, and a lesson can stack several of
                        these blocks on one page. */}
                    {isOpen ? null : (
                        <span
                            aria-hidden="true"
                            className={`absolute -inset-1 -z-10 rounded-full opacity-25 ${accent.bgSolid}`}
                        />
                    )}

                    {/* The pulse, only while this pin is still unread. It stops
                        for good once opened -- see `visitedIds` above. */}
                    {isOpen || isVisited ? null : (
                        <span
                            aria-hidden="true"
                            className={`absolute -inset-1 -z-10 rounded-full opacity-40 motion-safe:animate-ping ${accent.bgSolid}`}
                        />
                    )}
                  </button>
              )
            })}
          </div>
          )}
        </div>

        {openHotspot ? (
            <Card className={`!border-l-4 p-5 ${accent.border} ${accent.bgSoft}`}>
              <div className="flex items-start gap-3">
                <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${accent.bgSolid}`}
                >
                  {openIndex + 1}
                </span>

                <div className="min-w-0">
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {openHotspot.title}
                  </h3>

                  {openHotspot.description ? (
                      <p className="mt-2 leading-7 text-muted-foreground">
                        {openHotspot.description}
                      </p>
                  ) : null}
                </div>
              </div>
            </Card>
        ) : (
            <p className="text-center text-sm text-muted-foreground">
              Select a numbered point on the image to read about it.
            </p>
        )}
      </div>
  )
}

function LessonTool({ tool, index = 0 }) {
  const data = tool?.data ?? {}
  const accent = accentFor(index)

  if (tool.type === "heading") {
    return (
        <h2 className={`rounded-r-[var(--radius-rb-tile)] border-l-4 py-2 pl-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl ${accent.border} ${accent.bgSoft}`}>
          {data.text}
        </h2>
    )
  }

  if (tool.type === "subheading") {
    // No leading dot. It read as a bullet, which made a heading look like the
    // first item of a list that never followed -- and where a real list did
    // follow, like a stray extra bullet above it.
    return (
        <h3 className="text-lg font-semibold text-foreground sm:text-xl">
          {data.text}
        </h3>
    )
  }

  if (tool.type === "description") {
    return (
        <div className="space-y-3">
          {/* Body copy is the thing a learner is here to read -- it gets the
              larger size, and `leading-8` on a 17px body is the tighter of the
              two ratios, not the looser. */}
          {renderText(data.text, "text-[17px] leading-8 text-foreground/85")}
        </div>
    )
  }

  if (tool.type === "unordered-list" || tool.type === "ordered-list") {
    const ordered = tool.type === "ordered-list"
    const Tag = ordered ? "ol" : "ul"

    /* Markers drawn as elements rather than left to `list-disc` /
       `list-decimal`. A native marker cannot be sized, filled or aligned
       independently of its line box, so an accent colour was the only thing
       these lists could express -- and learning objectives, which is what most
       of them are, ended up looking like a default browser list in the middle
       of an otherwise designed page.

       `data-marker` is the hook the topic page's dark section tone uses to
       re-ink these; the accent shades are tuned for a light card. */
    return (
        <Tag className="space-y-3">
          {(data.items ?? []).map((item, itemIndex) => (
              <li
                  key={item.id ?? item.text}
                  className="flex gap-3 text-[17px] leading-7 text-foreground"
              >
                {ordered ? (
                    <span
                        data-marker
                        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums ${accent.bgSoft} ${accent.text}`}
                    >
                      {itemIndex + 1}
                    </span>
                ) : (
                    /* `mt-[0.6em]`, not a fixed pixel offset: the dot has to sit
                       on the first line's optical centre, and that moves with
                       the body size this block inherits. */
                    <span
                        data-marker
                        aria-hidden="true"
                        className={`mt-[0.6em] size-2 shrink-0 rounded-full ${accent.bgSolid}`}
                    />
                )}

                <span className="min-w-0 flex-1">{item.text}</span>
              </li>
          ))}
        </Tag>
    )
  }

  if (tool.type === "image") {
    return data.imageKey ? (
        <div>
          {/* `aspect-video w-full`, the same box the video block below uses, so
              every piece of media in a lesson is one width and one height
              instead of each image sizing itself to whatever it happens to be.
              The old `max-h-[520px]` let a tall image dictate its own height
              and a short one collapse, which is what made a run of them look
              ragged.

              `object-contain`, not cover: these are mostly diagrams, and
              cropping one to fill the box cuts off the labels around its
              edges -- exactly the part a learner needs. Contain fits the whole
              image and lets the Muted backing show where the aspect does not
              match. */}
          <LessonImage
              imageKey={data.imageKey}
              className="aspect-video w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
              sourceUrl={data.imageSourceUrl}
              sourceName={data.imageSourceName}
          />
        </div>
    ) : null
  }

  if (tool.type === "video") {
    return data.videoKey ? (
        <VideoBlock
            videoKey={data.videoKey}
            className="aspect-video w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-foreground"
        />
    ) : null
  }

  if (tool.type === "image-hotspot") {
    return <ImageHotspotBlock data={data} accent={accent} />
  }

  if (tool.type === "image-left-text" || tool.type === "image-right-text") {
    const image = data.imageKey ? (
        <LessonImage
            imageKey={data.imageKey}
            alt={data.title ?? ""}
            className="h-full min-h-72 w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
            sourceUrl={data.imageSourceUrl}
            sourceName={data.imageSourceName}
        />
    ) : (
        <div className="flex h-full min-h-72 items-center justify-center rounded-[var(--radius-rb-tile)] border-2 border-dashed border-border bg-muted text-muted-foreground">
          No image
        </div>
    )

    const text = (
        <Card className={`!border-t-4 p-6 ${accent.border} ${accent.bgSoft}`}>
          <h3 className="font-heading text-xl font-semibold text-foreground">
            {data.title}
          </h3>

          <p className="mt-3 leading-7 text-muted-foreground">
            {data.description}
          </p>
        </Card>
    )

    return (
        <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
          {tool.type === "image-left-text" ? image : text}
          {tool.type === "image-left-text" ? text : image}
        </div>
    )
  }

  if (tool.type === "tabs") {
    return <TabsBlock items={data.items ?? []} />
  }

  if (tool.type === "accordion") {
    return <AccordionBlock items={data.items ?? []} />
  }

  if (tool.type === "flip-grid") {
    return (
        <div className="grid gap-4 sm:grid-cols-2">
          {(data.cards ?? []).map((card, cardIndex) => (
              <FlipCard
                  key={card.id ?? card.frontTitle ?? cardIndex}
                  frontTitle={card.frontTitle}
                  backTitle={card.backTitle}
                  description={card.description}
                  accent={accentFor(cardIndex)}
              />
          ))}
        </div>
    )
  }

  if (tool.type === "intro-image-card") {
    return (
        <Card className={`!border-t-4 p-6 ${accent.border} ${accent.bgSoft}`}>
          <SectionIntro smallHeader={data.smallHeader} description={data.description} accent={accent} />
          {data.imageKey ? (
              <div>
                {/* Same media box as the standalone image and video blocks --
                    an image inside a card is still an image, and sizing it by
                    a different rule is what made two of them next to each
                    other look mismatched. */}
                <LessonImage
                    imageKey={data.imageKey}
                    className="aspect-video w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
                    sourceUrl={data.imageSourceUrl}
                    sourceName={data.imageSourceName}
                />
              </div>
          ) : null}
        </Card>
    )
  }

  if (tool.type === "header-description-grid" || tool.type === "image-feature-grid") {
    return (
        <div className="space-y-4">
          <SectionIntro smallHeader={data.smallHeader} description={data.description} accent={accent} />
          {tool.type === "image-feature-grid" && data.imageKey ? (
              <div>
                <LessonImage
                    imageKey={data.imageKey}
                    className="max-h-[420px] w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
                    sourceUrl={data.imageSourceUrl}
                    sourceName={data.imageSourceName}
                />
              </div>
          ) : null}
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
            {(data.gridItems ?? []).map((item, itemIndex) => {
              const itemAccent = accentFor(itemIndex)
              return (
                  <Card
                      key={item.id ?? itemIndex}
                      size="sm"
                      className={`!border-t-4 p-4 transition ${itemAccent.border} ${itemAccent.bgSoft}`}
                  >
                    <h4 className="font-heading font-semibold text-foreground">{item.title}</h4>
                    <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </Card>
              )
            })}
          </div>
        </div>
    )
  }

  if (tool.type === "review-card-grid") {
    return (
        <div className="space-y-4">
          <SectionIntro smallHeader={data.smallHeader} description={data.description} accent={accent} />
          <div className="grid gap-4 sm:grid-cols-2">
            {(data.cards ?? []).map((card, cardIndex) => (
                <FlipCard
                    key={card.id ?? cardIndex}
                    frontTitle={card.frontTitle}
                    backTitle={card.backTitle}
                    description={card.description}
                    accent={accentFor(cardIndex)}
                />
            ))}
          </div>
        </div>
    )
  }

  if (tool.type === "content-accordion-block") {
    return (
        <div className="space-y-4">
          <SectionIntro smallHeader={data.smallHeader} description={data.description} accent={accent} />
          <AccordionBlock items={data.items ?? []} />
        </div>
    )
  }

  if (tool.type === "content-tabs-block") {
    return (
        <div className="space-y-4">
          <SectionIntro smallHeader={data.smallHeader} description={data.description} accent={accent} />
          <TabsBlock items={data.items ?? []} />
        </div>
    )
  }

  if (tool.type === "media-text-block") {
    const mediaOnRight = data.layout === "image-right"
    const media =
        data.mediaType === "video" ? (
            data.videoKey ? (
                <VideoBlock
                    videoKey={data.videoKey}
                    className="aspect-video w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-foreground"
                />
            ) : (
                <div className="flex h-full min-h-72 items-center justify-center rounded-[var(--radius-rb-tile)] border-2 border-dashed border-border bg-muted text-muted-foreground">
                  No video
                </div>
            )
        ) : data.imageKey ? (
            <LessonImage
                imageKey={data.imageKey}
                alt={data.supportingTitle ?? ""}
                className="h-full min-h-72 w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
                sourceUrl={data.imageSourceUrl}
                sourceName={data.imageSourceName}
            />
        ) : (
            <div className="flex h-full min-h-72 items-center justify-center rounded-[var(--radius-rb-tile)] border-2 border-dashed border-border bg-muted text-muted-foreground">
              No media
            </div>
        )

    const text = (
        <Card className={`!border-t-4 p-6 ${accent.border} ${accent.bgSoft}`}>
          {data.supportingTitle ? (
              <h3 className="font-heading text-xl font-semibold text-foreground">
                {data.supportingTitle}
              </h3>
          ) : null}
          {data.supportingDescription ? (
              <p className="mt-3 leading-7 text-muted-foreground">
                {data.supportingDescription}
              </p>
          ) : null}
        </Card>
    )

    return (
        <div className="space-y-4">
          <SectionIntro smallHeader={data.smallHeader} description={data.description} accent={accent} />
          <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
            {mediaOnRight ? text : media}
            {mediaOnRight ? media : text}
          </div>
        </div>
    )
  }

  return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Unsupported lesson block: {tool.type}
      </div>
  )
}

export { LessonTool }

/** Parses a lesson_component_structure string and renders its blocks. */
export function LessonContent({ structure, className = "space-y-8" }) {
  const blocks = parseLessonStructure(structure)
  if (blocks.length === 0) {
    return null
  }
  return (
    <div className={className}>
      {blocks.map((tool, index) => (
        <LessonTool key={tool.id ?? index} tool={tool} index={index} />
      ))}
    </div>
  )
}
