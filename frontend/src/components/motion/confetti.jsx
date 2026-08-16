import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import { useReducedMotion } from "@/components/motion/rebyu-motion.jsx"

/**
 * A confetti burst, on a canvas, with no dependency behind it.
 *
 * `@tsparticles/*` is already installed and could do this, but it is a general
 * particle engine configured through a large options object and mounted as a
 * React tree of its own -- several hundred KB and a container lifecycle to
 * manage, for one burst of paper that lives two seconds. The whole effect is
 * "spawn N rectangles, apply gravity and drag, rotate, fade", which is the
 * function below.
 *
 * Drawn into a portal at <body>, not inside whatever opened it. The award modal
 * is the caller, and Radix centres its content with a `translate` -- a
 * transformed ancestor becomes the containing block for `position: fixed`, so a
 * canvas rendered inside the dialog would be pinned to the dialog's box and
 * clipped to it rather than covering the viewport.
 *
 * The colours are the design system's tone solids: the same set the bubble
 * cards, badges and buttons are drawn in, so the paper belongs to the product
 * rather than arriving from a library's default palette.
 */

const COLORS = ["#1B6EF3", "#1CB0F6", "#FF9600", "#FFC800", "#CE82FF", "#00B8D4", "#58CC02"]

const PARTICLE_COUNT = 90
const GRAVITY = 0.32
const DRAG = 0.987
const FADE_AFTER_MS = 1100
const MAX_LIFE_MS = 2600

function createParticles(width, height) {
  const particles = []

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    /* Two cannons angled inward from the lower corners, which is the shape that
       reads as celebration -- confetti dropped from the top reads as snow. */
    const fromLeft = index % 2 === 0
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9
    const speed = 13 + Math.random() * 11

    particles.push({
      x: fromLeft ? width * 0.08 : width * 0.92,
      y: height * 0.98,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      // Rectangles rather than squares, so rotation reads as paper flipping.
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.34,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
  }

  return particles
}

/**
 * @param fire  a value that starts a burst whenever it changes to something
 *              truthy -- pass the thing being celebrated, so a second award
 *              re-fires rather than the effect running once per mount
 */
export function Confetti({ fire }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!fire || reduced) {
      return undefined
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!context) {
      return undefined
    }

    // Backing store in device pixels, drawing in CSS pixels: on a 2x display a
    // 1x canvas is visibly soft, and the paper is small enough to show it.
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    context.scale(ratio, ratio)

    const particles = createParticles(width, height)
    const startedAt = performance.now()
    let frame = 0

    function draw(now) {
      const elapsed = now - startedAt
      context.clearRect(0, 0, width, height)

      const fade = elapsed <= FADE_AFTER_MS
        ? 1
        : Math.max(0, 1 - (elapsed - FADE_AFTER_MS) / (MAX_LIFE_MS - FADE_AFTER_MS))

      for (const particle of particles) {
        particle.vy += GRAVITY
        particle.vx *= DRAG
        particle.vy *= DRAG
        particle.x += particle.vx
        particle.y += particle.vy
        particle.rotation += particle.spin

        context.save()
        context.globalAlpha = fade
        context.translate(particle.x, particle.y)
        context.rotate(particle.rotation)
        context.fillStyle = particle.color
        context.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h)
        context.restore()
      }

      if (elapsed < MAX_LIFE_MS) {
        frame = requestAnimationFrame(draw)
      } else {
        context.clearRect(0, 0, width, height)
      }
    }

    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      context.clearRect(0, 0, width, height)
    }
  }, [fire, reduced])

  // No canvas at all unless something is being celebrated: this host is mounted
  // at the app root for the whole session, and a full-viewport canvas sitting
  // over every page is worth avoiding even when it cannot be clicked through.
  if (!fire || reduced || typeof document === "undefined") {
    return null
  }

  return createPortal(
    /* Above the dialog overlay (z-50) and inert to the pointer: the "keep
       going" button sits under this canvas and has to stay clickable. */
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] size-full"
    />,
    document.body
  )
}

export default Confetti
