/**
 * REBYU design system primitives.
 *
 * Geometry, depth and motion live in `src/styles/rebyu-ds.css`; these
 * components only choose variants and compose children. Anything rendering
 * these must sit inside a `.rebyu-ds` scope so the tokens resolve.
 */
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const BUTTON_VARIANTS = {
  feather: "",
  mask: "rb-btn-mask",
  macaw: "rb-btn-macaw",
  beetle: "rb-btn-beetle",
  fox: "rb-btn-fox",
  cardinal: "rb-btn-cardinal",
  ghost: "rb-btn-ghost",
  snow: "rb-btn-snow",
};

const BUTTON_SIZES = {
  sm: "rb-btn-sm",
  md: "",
  lg: "rb-btn-lg",
};

/**
 * The tactile key. Presses travel the full lip height so the control reads as
 * physical. `asChild` lets a router <Link> inherit the treatment.
 */
export function TactileButton({
  variant = "feather",
  size = "md",
  asChild = false,
  className,
  ...props
}) {
  const Component = asChild ? Slot.Root : "button";

  return (
    <Component
      className={cn("rb-btn", BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

export function RebyuCard({ raised = false, press = false, className, ...props }) {
  return (
    <div
      className={cn(
        "rb-card",
        raised && "rb-card-raised",
        press && "rb-card-press",
        className,
      )}
      {...props}
    />
  );
}

export function Chip({ tone = "neutral", className, children, ...props }) {
  const TONES = {
    neutral: "",
    feather: "bg-rb-feather-wash text-[#3d6b06]",
    macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
    bee: "bg-rb-bee-wash text-[#8a6d00]",
    fox: "bg-rb-fox-wash text-rb-fox-lip",
    beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
    cardinal: "bg-rb-cardinal-wash text-rb-cardinal-lip",
  };

  return (
    <span className={cn("rb-chip", TONES[tone], className)} {...props}>
      {children}
    </span>
  );
}

/**
 * Mastery / completion bar. `label` is required for a11y because the bar is
 * frequently the only representation of the value on screen.
 */
export function ProgressBar({ value, label, tone = "mask", className }) {
  const clamped = Math.max(0, Math.min(100, value));
  const TONES = {
    mask: "bg-rb-mask",
    feather: "bg-rb-feather",
    macaw: "bg-rb-macaw",
    fox: "bg-rb-fox",
    bee: "bg-rb-bee",
    beetle: "bg-rb-beetle",
  };

  return (
    <div
      className={cn("rb-progress", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("rb-progress-fill", TONES[tone])} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/**
 * A single answer option. `state` drives colour only — the box never resizes
 * between states, so feedback never shifts the layout under the user's finger.
 */
export function AnswerOption({ optionKey, state = "idle", className, children, ...props }) {
  return (
    <button type="button" data-state={state} className={cn("rb-answer", className)} {...props}>
      <span className="rb-answer-key">{optionKey}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

/** Metric tile used across the dashboard and gamification widgets. */
export function StatTile({ icon: Icon, value, label, tone = "feather", className }) {
  const TONES = {
    feather: "bg-rb-feather-wash text-rb-feather-lip",
    macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
    bee: "bg-rb-bee-wash text-[#8a6d00]",
    fox: "bg-rb-fox-wash text-rb-fox-lip",
    beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
  };

  return (
    <div className={cn("rb-card flex items-center gap-4", className)}>
      {Icon ? (
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", TONES[tone])}>
          <Icon className="size-6" aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0">
        <div className="rb-numeric text-2xl leading-none">{value}</div>
        <div className="mt-1 truncate text-sm font-medium text-rb-wolf">{label}</div>
      </div>
    </div>
  );
}
