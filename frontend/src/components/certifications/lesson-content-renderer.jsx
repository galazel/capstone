import { useState } from "react"
import { motion } from "framer-motion"
import { getFileViewUrl } from "@/services/fileService.js"
import { parseLessonStructure } from "@/services/learnerService.js"
import { RotateCcw } from "@/components/icons"
import { Card } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Shared, presentational lesson-body renderer -- extracted verbatim from
// the learner lesson page so the enterprise content viewer renders lessons
// identically. Pure: takes a block (tool) or a structure string, no data
// fetching, no progress/completion concerns.
//
// Every block below uses the shadcn semantic tokens (`border-border`,
// `text-foreground`, `bg-card`, `text-primary`, ...) rather than hardcoded
// zinc hex values, on purpose: this renderer runs both inside the learner
// portal's `.rebyu-ds` scope and outside it in the enterprise content
// viewer, and only the semantic tokens resolve correctly in both.

const EASE = [0.22, 1, 0.36, 1]

// Chart tokens rather than the `.rebyu-ds` palette: they're plain `:root`
// variables (see index.css), so they resolve identically in the enterprise
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
 * AI-generated lessons store either a plain search-result URL (image or
 * YouTube link) or an admin-uploaded internal storage key in the same
 * `imageKey`/`videoKey` field. Routing an absolute URL through
 * `getFileViewUrl` mangles it into `/files/view?key=https://...`, which the
 * file endpoint rejects -- that's what rendered as a broken image / blank
 * video. Absolute URLs are used as-is; anything else is treated as a key.
 */
function resolveMediaSrc(key) {
  if (!key) return ""
  if (key.startsWith("http://") || key.startsWith("https://")) {
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
function VideoBlock({ videoKey, className }) {
  const src = resolveMediaSrc(videoKey)
  if (!src) return null

  const embedUrl = getYouTubeEmbedUrl(src)
  if (embedUrl) {
    return (
        <iframe
            src={embedUrl}
            title="Lesson video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={className}
        />
    )
  }

  return <video controls className={className} src={src} />
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

/** Accordion body -- the shared, already-themed primitive so every collapsible
 * section in the app (not just lessons) shares one look. */
function AccordionBlock({ items = [] }) {
  if (items.length === 0) return null

  return (
      <Accordion type="single" collapsible defaultValue={String(items[0]?.id ?? 0)} className="px-1">
        {items.map((item, index) => {
          const id = String(item.id ?? index)
          return (
              <AccordionItem key={id} value={id}>
                <AccordionTrigger className="text-base text-foreground">
                  {item.title}
                </AccordionTrigger>
                <AccordionContent className="text-[15px] leading-6 text-muted-foreground">
                  {item.content}
                </AccordionContent>
              </AccordionItem>
          )
        })}
      </Accordion>
  )
}

/** Real tabs, using the shared segmented-pill primitive. */
function TabsBlock({ items = [] }) {
  if (items.length === 0) return null

  return (
      <Tabs defaultValue="0" className="gap-0">
        <TabsList className="w-full flex-wrap">
          {items.map((item, index) => (
              <TabsTrigger key={item.id ?? item.label ?? index} value={String(index)}>
                {item.label ?? item.title ?? `Tab ${index + 1}`}
              </TabsTrigger>
          ))}
        </TabsList>

        {items.map((item, index) => (
            <TabsContent key={item.id ?? item.label ?? index} value={String(index)} className="pt-4">
              {item.label ? (
                  <p className="text-sm font-semibold text-muted-foreground">{item.label}</p>
              ) : null}
              <h3 className="mt-1 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                {item.description}
              </p>
            </TabsContent>
        ))}
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
            <p className={`font-heading font-semibold ${accent.text}`}>{backTitle}</p>
            <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{description}</p>
          </Card>
        </motion.div>
      </button>
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
    return (
        <h3 className="flex items-center gap-2.5 text-lg font-semibold text-foreground sm:text-xl">
          <span className={`inline-block size-2 shrink-0 rounded-full ${accent.bgSolid}`} aria-hidden="true" />
          {data.text}
        </h3>
    )
  }

  if (tool.type === "description") {
    return (
        <div className="space-y-3">
          {renderText(data.text, "text-base leading-8 text-muted-foreground")}
        </div>
    )
  }

  if (tool.type === "unordered-list" || tool.type === "ordered-list") {
    const Tag = tool.type === "ordered-list" ? "ol" : "ul"

    return (
        <Tag
            className={`space-y-2 pl-6 text-foreground marker:font-semibold ${accent.marker} ${
                tool.type === "ordered-list" ? "list-decimal" : "list-disc"
            }`}
        >
          {(data.items ?? []).map((item) => (
              <li key={item.id ?? item.text}>{item.text}</li>
          ))}
        </Tag>
    )
  }

  if (tool.type === "image") {
    return data.imageKey ? (
        <div>
          <img
              src={resolveMediaSrc(data.imageKey)}
              alt=""
              className="max-h-[520px] w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
          />
          <ImageAttribution sourceUrl={data.imageSourceUrl} sourceName={data.imageSourceName} />
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

  if (tool.type === "image-left-text" || tool.type === "image-right-text") {
    const image = data.imageKey ? (
        <div>
          <img
              src={resolveMediaSrc(data.imageKey)}
              alt={data.title ?? ""}
              className="h-full min-h-72 w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
          />
          <ImageAttribution sourceUrl={data.imageSourceUrl} sourceName={data.imageSourceName} />
        </div>
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
                <img
                    src={resolveMediaSrc(data.imageKey)}
                    alt=""
                    className="max-h-[520px] w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
                />
                <ImageAttribution sourceUrl={data.imageSourceUrl} sourceName={data.imageSourceName} />
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
                <img
                    src={resolveMediaSrc(data.imageKey)}
                    alt=""
                    className="max-h-[420px] w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
                />
                <ImageAttribution sourceUrl={data.imageSourceUrl} sourceName={data.imageSourceName} />
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
            <div>
              <img
                  src={resolveMediaSrc(data.imageKey)}
                  alt={data.supportingTitle ?? ""}
                  className="h-full min-h-72 w-full rounded-[var(--radius-rb-tile)] border-2 border-border/70 bg-muted object-contain"
              />
              <ImageAttribution sourceUrl={data.imageSourceUrl} sourceName={data.imageSourceName} />
            </div>
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
