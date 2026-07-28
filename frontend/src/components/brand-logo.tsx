type BrandLogoProps = {
  className?: string
}

/**
 * Rebyu mark: a typographic monogram rather than an image asset.
 *
 * Drawn as an SVG so it stays crisp at every size, needs no network request,
 * and inherits sizing from the same `size-*` classes the old <img> used — every
 * existing call site keeps working unchanged. Decorative by default: the
 * wordmark next to it carries the name.
 */
export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* lip first, so the face sits on top of it */}
      <rect x="2" y="6" width="36" height="32" rx="11" fill="#46A302" />
      <rect x="2" y="2" width="36" height="32" rx="11" fill="#58CC02" />
      <text
        x="20"
        y="19"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize="22"
        fontWeight="800"
        fontFamily='"Feather Bold", "Nunito", ui-rounded, system-ui, sans-serif'
      >
        r
      </text>
    </svg>
  )
}
