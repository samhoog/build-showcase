// Minecraft usernames: 3-16 chars, letters, digits and underscore
const USERNAME = /^[A-Za-z0-9_]{3,16}$/

export function isValidUsername(name: string): boolean {
  return USERNAME.test(name)
}

// 'Harbour Lighthouse v2' -> 'harbour-lighthouse-v2'
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// 'harbour-lighthouse' -> 'Harbour lighthouse'
export function titleFromSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
