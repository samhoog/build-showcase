// npm run deploy: build the site and publish it to the gh-pages branch.
//
// The models are gitignored, so only a machine that has them can build the real site: this
// runs from here, not from CI. The built site is committed straight to `gh-pages` as a
// single parentless commit and force-pushed, so `main` never carries model files and old
// versions of them stop being referenced.
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PUBLIC_DIR } from './lib/paths.ts'

const BRANCH = 'gh-pages'
const OUT = resolve('dist')

function git(args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync('git', args, { encoding: 'utf8', env: { ...process.env, ...env } }).trim()
}

// github.com/<owner>/<repo>(.git), over https or ssh
function repoName(): string {
  const remote = git(['remote', 'get-url', 'origin'])
  const name = remote
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .pop()
  if (!name) throw new Error(`could not read a repo name from "${remote}"`)
  return name
}

// A project site lives under /<repo>/; a <user>.github.io repo is served at the root
function basePath(repo: string): string {
  return repo.toLowerCase().endsWith('.github.io') ? '/' : `/${repo}/`
}

const repo = repoName()
const base = basePath(repo)

const manifest = join(PUBLIC_DIR, 'builds', 'manifest.json')
if (!(await stat(manifest).catch(() => null))) {
  console.error(`No ${manifest}. Run npm run convert first: the site is built from your models.`)
  process.exit(1)
}

console.log(`building for ${base}`)
execFileSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: base },
})
// Pages runs Jekyll over the branch otherwise, which drops files that start with an underscore
await writeFile(join(OUT, '.nojekyll'), '')

// Build the commit without touching the working tree or checking anything out: stage the
// built site into a scratch index, turn that into a tree, and commit it with no parent.
const scratch = await mkdtemp(join(tmpdir(), 'deploy-'))
const env = { GIT_INDEX_FILE: join(scratch, 'index') }
try {
  git(['--work-tree', OUT, 'add', '--all', '--force', OUT], env)
  const tree = git(['write-tree'], env)
  const message = `deploy ${git(['rev-parse', '--short', 'HEAD'])}`
  const commit = git(['commit-tree', tree, '-m', message])
  console.log(`pushing the built site to ${BRANCH}`)
  execFileSync('git', ['push', '--force', 'origin', `${commit}:refs/heads/${BRANCH}`], {
    stdio: 'inherit',
  })
} finally {
  await rm(scratch, { recursive: true, force: true })
}

const owner = git(['remote', 'get-url', 'origin'])
  .replace(/\.git$/, '')
  .split(/[/:]/)
  .at(-2)
console.log(`\nPublished. In a minute or two: https://${owner}.github.io${base}`)
console.log(`If this is the first deploy, set Pages to serve the ${BRANCH} branch (root).`)
