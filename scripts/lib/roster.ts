import { readFile } from 'node:fs/promises'

// players.json: the committed list of usernames. Missing means nobody is on it yet.
export async function readRoster(path: string): Promise<string[]> {
  return readFile(path, 'utf8').then(
    (text) => JSON.parse(text) as string[],
    () => [],
  )
}
