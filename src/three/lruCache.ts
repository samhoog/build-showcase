// Reference-counted cache with least-recently-used eviction. Entries in use are never
// evicted; idle ones are dropped oldest-first once the cache holds more than `capacity`.
export class LruCache<T> {
  private entries = new Map<string, { value: T; refs: number }>()
  private capacity: number
  private create: (key: string) => T
  private destroy: (value: T) => void

  constructor(capacity: number, create: (key: string) => T, destroy: (value: T) => void) {
    this.capacity = capacity
    this.create = create
    this.destroy = destroy
  }

  acquire(key: string): T {
    const entry = this.entries.get(key) ?? { value: this.create(key), refs: 0 }
    entry.refs++
    // re-insert so Map order is least to most recently used
    this.entries.delete(key)
    this.entries.set(key, entry)
    this.evict()
    return entry.value
  }

  release(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return
    entry.refs = Math.max(0, entry.refs - 1)
    this.evict()
  }

  // drop an entry regardless of age, e.g. after a failed load, so the next acquire retries
  forget(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return
    this.entries.delete(key)
    this.destroy(entry.value)
  }

  has(key: string): boolean {
    return this.entries.has(key)
  }

  private evict() {
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= this.capacity) return
      if (entry.refs === 0) {
        this.entries.delete(key)
        this.destroy(entry.value)
      }
    }
  }
}
