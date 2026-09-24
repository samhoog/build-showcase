// longest step an animation is ever handed, so a background tab doesn't resume with a lurch
const MAX_DELTA = 0.1

// Seconds between two requestAnimationFrame timestamps. Both arguments must be rAF
// timestamps: mixing in performance.now() leaves out the time spent rendering, and on a
// fast display that makes the delta negative, which sends every eased animation unstable.
export function frameDelta(now: number, previous: number | null): number {
  if (previous === null) return 0
  return Math.min(Math.max((now - previous) / 1000, 0), MAX_DELTA)
}

// How long drawing rests after a frame, as a multiple of what that frame cost. Two parts
// rest to one part drawing keeps most of each second free for scrolling and taps. The
// fullscreen viewer has the page to itself, so it rests less and turns more smoothly.
const REST = 2
const REST_FOCUSED = 0.5

// When drawing may resume after a frame that started at `now` and took `drawMs` to draw.
// A fast GPU draws in a couple of milliseconds, so this lands before its next frame and
// changes nothing. A phone struggling with a two-million-triangle build gets fewer model
// frames per second, and a page that still scrolls.
export function restUntil(now: number, drawMs: number, focused: boolean): number {
  return now + drawMs * (1 + (focused ? REST_FOCUSED : REST))
}
