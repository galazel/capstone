import logoImage from "@/assets/logo.png"

type BrandLogoProps = {
  className?: string
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <img
      src={logoImage}
      alt=""
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  )
}
