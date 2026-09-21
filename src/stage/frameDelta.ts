// longest step an animation is ever handed, so a background tab doesn't resume with a lurch
const MAX_DELTA = 0.1

// Seconds between two requestAnimationFrame timestamps. Both arguments must be rAF
// timestamps: mixing in performance.now() leaves out the time spent rendering, and on a
// fast display that makes the delta negative, which sends every eased animation unstable.
export function frameDelta(now: number, previous: number | null): number {
  if (previous === null) return 0
  return Math.min(Math.max((now - previous) / 1000, 0), MAX_DELTA)
}
