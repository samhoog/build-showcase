// Last known mouse position, shared by every player figure so they can follow the cursor
// with a single listener. Stays null on touch devices, where figures glance around instead.
export const pointer: { position: { x: number; y: number } | null } = { position: null }

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'mouse') pointer.position = { x: event.clientX, y: event.clientY }
})
document.documentElement.addEventListener('pointerleave', () => {
  pointer.position = null
})

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
