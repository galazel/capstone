import { cn } from "@/lib/utils"

/**
 * The default cover for a certification: its name, huge, on Feather blue.
 *
 * This is the landing page footer's device, reused. There, one oversized
 * lowercase wordmark sits on the bottom edge and is clipped by it — the mark
 * is the graphic, not a label placed on one. A certification cover is the same
 * problem (a surface that has to say one name and nothing else), so it gets the
 * same answer instead of a photograph. No uploads, no stock imagery, and a
 * title that stays legible at any length because nothing is competing with it.
 *
 * The type is sized in `cqi` — percent of the panel's own width — so the mark
 * fills a 260px card tile and a full-width banner identically.
 */

/** Rough advance width of the display face, in ems per character. Measured off
 *  the rendered mark rather than derived — it only has to be close enough to
 *  keep the longest word inside the panel. */
const CHAR_WIDTH = 0.52

/** Two limits, whichever bites first:
 *  - the longest word has to fit one line, or it breaks mid-word;
 *  - the whole title has to fit a few lines, or it grows past the panel and
 *    gets clipped from the TOP, which cuts the beginning of the name off.
 *  100 is the panel's own width in cqi; ~175 is about three lines of it. */
function markSize(title) {
  const text = String(title ?? "").trim()
  const words = text.split(/\s+/).filter(Boolean)
  const longest = words.reduce((max, word) => Math.max(max, word.length), 0)
  if (!longest) return 28

  const byWord = 100 / (longest * CHAR_WIDTH)
  const byLength = 175 / (text.length * CHAR_WIDTH)

  return Math.min(34, Math.max(9, Math.min(byWord, byLength)))
}

export default function CertificationCover({ title, className, children }) {
  return (
    <div
      className={cn(
        // Always full-strength blue. There is no dimmed variant: a generating
        // or empty certification is marked by a badge over the cover, not by
        // draining the colour out of it.
        "rebyu-ds relative isolate flex items-end overflow-hidden bg-rb-feather",
        className,
      )}
      style={{ containerType: "inline-size" }}
    >
      {/* Bottom-right and bled off both edges on purpose — a wordmark that fits
          inside its box reads as a logo placement rather than as the surface
          itself. */}
      <span
        className="block w-full select-none pl-4 pr-3 text-right font-rb-display font-black lowercase leading-[0.72] tracking-tight text-white [overflow-wrap:anywhere]"
        style={{
          fontSize: `${markSize(title)}cqi`,
          marginBottom: "-0.12em",
          marginRight: "-0.06em",
        }}
      >
        {title}
      </span>

      {children}
    </div>
  )
}
