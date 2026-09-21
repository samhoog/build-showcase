import { expect, type Locator, type Page, test } from '@playwright/test'

type Counted = { webglContexts: number }

// Share of a canvas's pixels that have been drawn on. Canvases are transparent until the
// Stage copies a rendered frame into them, so anything above zero means 3D made it to screen.
async function inkOf(canvas: Locator): Promise<number> {
  return canvas.evaluate((el: HTMLCanvasElement) => {
    const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height)
    let drawn = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++
    return drawn / (data.length / 4)
  })
}

// The canvas's own pixels, without the page furniture (captions, focus rings) laid over it
async function pixelsOf(canvas: Locator): Promise<string> {
  return canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())
}

async function expectDrawn(canvas: Locator) {
  await expect.poll(() => inkOf(canvas), { timeout: 15_000 }).toBeGreaterThan(0.02)
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function open(canvas: Locator, isMobile: boolean) {
  if (isMobile) await canvas.tap()
  else await canvas.click()
}

// count every canvas that is handed a WebGL context, across the whole visit
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const counter = window as unknown as Counted
    counter.webglContexts = 0
    const original = HTMLCanvasElement.prototype.getContext as (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) => unknown
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      const context = original.call(this, type, ...rest)
      if (context && type.startsWith('webgl')) counter.webglContexts++
      return context
    } as typeof HTMLCanvasElement.prototype.getContext
  })
})

test('home page lines up every player as a link with a 3D figure', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Who built what' })).toBeVisible()

  const jeb = page.getByRole('link', { name: /jeb_.*3 builds/ })
  // Notch has two builds of his own plus the bridge he shared with jeb_
  const notch = page.getByRole('link', { name: /Notch.*3 builds/ })
  await expect(jeb).toBeVisible()
  await expect(notch).toBeVisible()
  await expectDrawn(jeb.locator('canvas'))
  await expectDrawn(notch.locator('canvas'))
  await expectNoSidewaysScroll(page)
})

test('player page shows each build as a live card', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /jeb_/ }).click()
  await expect(page).toHaveURL(/\/p\/jeb_$/)

  const cards = page.getByRole('article')
  await expect(cards).toHaveCount(3)
  await expect(cards.first().getByRole('heading')).toHaveText('Stone bridge')
  await expect(cards.first()).toContainText('29 × 11 × 11 blocks')
  await expectDrawn(cards.first().locator('canvas'))
  await expectNoSidewaysScroll(page)

  // cards further down load as they are scrolled towards
  await cards.last().scrollIntoViewIfNeeded()
  await expectDrawn(cards.last().locator('canvas'))
})

test("a shared build shows on every builder's page, credits the others, and is one file", async ({
  page,
}) => {
  const downloads: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('stone-bridge.glb')) downloads.push(request.url())
  })

  await page.goto('/')
  // five sample builds, even though the bridge is listed under two players
  await expect(page.getByText('2 players, 5 builds')).toBeVisible()

  await page.goto('/p/jeb_')
  const onJeb = page.getByRole('article').filter({ hasText: 'Stone bridge' })
  await expect(onJeb).toContainText('Built with Notch')
  await expectDrawn(onJeb.locator('canvas'))

  // the credit is a link to the other builder, whose page lists the same build
  await onJeb.getByRole('link', { name: 'Notch' }).click()
  await expect(page).toHaveURL(/\/p\/Notch$/)
  const onNotch = page.getByRole('article').filter({ hasText: 'Stone bridge' })
  await expect(onNotch).toContainText('Built with jeb_')
  await expectDrawn(onNotch.locator('canvas'))
  await expect(page.getByRole('article')).toHaveCount(3)

  // and it opens under his URL too, crediting jeb_
  await onNotch.getByRole('link', { name: 'Stone bridge' }).click()
  await expect(page).toHaveURL(/\/p\/Notch\/stone-bridge$/)
  await expect(page.getByRole('dialog')).toContainText('by Notch with jeb_')

  // both pages showed it, but the model came down once
  expect(new Set(downloads).size).toBe(1)
  expect(downloads).toHaveLength(1)
})

test('cards hold still until someone moves them, and say they can be opened', async ({ page }) => {
  await page.goto('/p/Notch')
  const card = page.getByRole('article').first()
  const canvas = card.locator('canvas')
  await expectDrawn(canvas)
  await page.waitForTimeout(500)
  const before = await pixelsOf(canvas)
  await page.waitForTimeout(2500)
  expect(await pixelsOf(canvas)).toBe(before)

  // the badge is the visible cue that the still picture is interactive
  await expect(card.getByText('Open')).toBeVisible()
})

test('a card opens the fullscreen viewer, and Escape or Back closes it', async ({
  page,
  isMobile,
}) => {
  await page.goto('/p/jeb_')
  const canvas = page.getByRole('article').first().locator('canvas')
  await expectDrawn(canvas)
  await expect(canvas).toHaveCSS('cursor', 'pointer')
  await open(canvas, isMobile)

  await expect(page).toHaveURL(/\/p\/jeb_\/stone-bridge$/)
  const viewer = page.getByRole('dialog', { name: 'Stone bridge' })
  await expect(viewer).toBeVisible()
  await expect(viewer.getByRole('button', { name: 'Close' })).toBeFocused()
  await expectDrawn(viewer.locator('canvas'))
  await expect(viewer.locator('canvas')).toHaveCSS('cursor', 'grab')

  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
  await expect(page).toHaveURL(/\/p\/jeb_$/)

  // and the browser's Back button closes it too
  await page.getByRole('link', { name: 'Watchtower' }).click()
  await expect(page.getByRole('dialog', { name: 'Watchtower' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('a build link opens straight into the viewer', async ({ page }) => {
  await page.goto('/p/jeb_/watchtower')
  const viewer = page.getByRole('dialog', { name: 'Watchtower' })
  await expect(viewer).toBeVisible()
  await expect(viewer).toContainText('19 × 29 × 19 blocks, by jeb_')
  await expectDrawn(viewer.locator('canvas'))

  await viewer.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(/\/p\/jeb_$/)
  await expect(page.getByRole('article')).toHaveCount(3)
})

test('dragging a card with the mouse orbits it instead of opening it', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'touch never orbits a card')
  await page.goto('/p/jeb_')
  const canvas = page.getByRole('article').first().locator('canvas')
  await expectDrawn(canvas)
  await page.waitForTimeout(500)
  const before = await pixelsOf(canvas)

  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 30, { steps: 8 })
  await expect(canvas).toHaveCSS('cursor', 'grabbing')
  await page.mouse.up()
  await expect(canvas).toHaveCSS('cursor', 'pointer')
  await page.waitForTimeout(800)

  await expect(page).toHaveURL(/\/p\/jeb_$/)
  expect(await pixelsOf(canvas)).not.toBe(before)
})

test('keyboard turns and resets the build in the viewer', async ({ page }) => {
  await page.goto('/p/jeb_/island-oak')
  const canvas = page.getByRole('dialog').locator('canvas')
  await expectDrawn(canvas)
  await page.waitForTimeout(500)
  const start = await pixelsOf(canvas)

  await canvas.focus()
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(800)
  expect(await pixelsOf(canvas)).not.toBe(start)

  await page.keyboard.press('r')
  await page.waitForTimeout(800)
  expect(await pixelsOf(canvas)).toBe(start)
})

test('the camera readout shows the view, and a build.json view is where the camera starts', async ({
  page,
}) => {
  // island-oak has no view of its own, so it starts at the default
  await page.goto('/p/jeb_/island-oak?camera')
  const readout = page.locator('pre', { hasText: '"view":' })
  await expect(readout).toHaveText('"view": {"azimuth":35,"elevation":24,"zoom":1}')

  // turning the build updates the readout live
  await page.getByRole('dialog').locator('canvas').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(readout).not.toHaveText(/"azimuth":35,/)

  // the watchtower's build.json says where to start, and the readout reads it back
  await page.goto('/p/jeb_/watchtower?camera')
  await expect(page.locator('pre', { hasText: '"view":' })).toHaveText(
    '"view": {"azimuth":-60,"elevation":10,"zoom":1.3}',
  )

  // C toggles it, and it is off by default
  await page.keyboard.press('c')
  await expect(page.locator('pre')).toHaveCount(0)
  await page.goto('/p/jeb_/watchtower')
  await expect(page.locator('pre')).toHaveCount(0)
})

test('touch scrolling is left to the page on cards, and taken over in the viewer', async ({
  page,
}) => {
  await page.goto('/p/jeb_')
  const card = page.getByRole('article').first().locator('canvas')
  await expectDrawn(card)
  await expect(card).toHaveCSS('touch-action', 'pan-y')

  await page.goto('/p/jeb_/watchtower')
  await expect(page.getByRole('dialog').locator('canvas')).toHaveCSS('touch-action', 'none')
})

test('the whole visit uses a single WebGL context', async ({ page, isMobile }) => {
  await page.goto('/')
  await expectDrawn(page.getByRole('link', { name: /jeb_/ }).locator('canvas'))
  await page.getByRole('link', { name: /jeb_/ }).click()
  const canvas = page.getByRole('article').first().locator('canvas')
  await expectDrawn(canvas)
  await open(canvas, isMobile)
  await expectDrawn(page.getByRole('dialog').locator('canvas'))

  // 2 figures, then 1 figure + 3 cards, then the viewer: all through one context
  expect(await page.evaluate(() => (window as unknown as Counted).webglContexts)).toBe(1)
})

test('an unknown player gets a specific message and a way back', async ({ page }) => {
  await page.goto('/p/Herobrine')
  await expect(page.getByRole('heading', { name: 'No player called Herobrine' })).toBeVisible()
  await page.getByRole('link', { name: 'See all players' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('an unknown build says so and still lists the rest', async ({ page }) => {
  await page.goto('/p/jeb_/nether-portal')
  await expect(page.getByRole('alert')).toContainText('jeb_ has no build called "nether-portal"')
  await expect(page.getByRole('article')).toHaveCount(3)
})

test('with nothing converted yet, the page explains how to add builds', async ({ page }) => {
  await page.route('**/builds/manifest.json', (route) => route.fulfill({ status: 404 }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No builds yet' })).toBeVisible()
  await expect(page.getByText('npm run convert').first()).toBeVisible()
})

test('a failed download can be retried', async ({ page }) => {
  let fail = true
  await page.route('**/builds/manifest.json', (route) => (fail ? route.abort() : route.continue()))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Couldn't load the builds" })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('link', { name: /Notch/ })).toBeVisible()
})
