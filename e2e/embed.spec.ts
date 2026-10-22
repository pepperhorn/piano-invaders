import { expect, test, type Page } from '@playwright/test'
import { MIDI_TO_QWERTY } from '../src/constants/gameConfig'

const GAME = '.piano-invaders'

async function open(page: Page) {
  // synth voice: no sample downloads, so the run is offline-safe
  await page.addInitScript(() => { try { localStorage.setItem('piano-invaders-voice', 'synth') } catch { /* ignore */ } })
  await page.goto('/embed.html')
  await page.waitForSelector(`${GAME} .pi-start`)
  await page.waitForFunction(() => !!(window as any).__piFixture)
}

async function start(page: Page) {
  const btn = page.locator(`${GAME} .pi-start button`).filter({ hasText: /^START$/ }).first()
  await expect(btn).toBeEnabled({ timeout: 15_000 })
  await btn.click()
}

const firstNote = (page: Page) =>
  page.waitForFunction(() => (window as any).__piFixture.noteXs().some((n: { y: number }) => n.y > 0), null, { timeout: 30_000 })

test('game fills its 720×480 box, not the viewport', async ({ page }) => {
  await open(page)
  const box = await page.locator(GAME).boundingBox()
  expect(box).not.toBeNull()
  expect(Math.round(box!.x)).toBe(40)
  expect(Math.round(box!.y)).toBe(120)
  expect(Math.round(box!.width)).toBe(720)
  expect(Math.round(box!.height)).toBe(480)
})

test('typing "asdf" in the fixture input does not light any key or fire', async ({ page }) => {
  await open(page)
  await start(page)
  await page.locator('.embed-fixture-input').focus()
  await page.keyboard.type('asdf')
  await expect(page.locator('.embed-fixture-input')).toHaveValue('asdf')
  await expect(page.locator(`${GAME} .pi-key.is-active`)).toHaveCount(0)
  await expect(page.locator(`${GAME} .pi-hud-score .pi-hud-value`)).toHaveText('000000')
})

test('after clicking Start, pressing the QWERTY key for the first target hits it (score becomes 10)', async ({ page }) => {
  await open(page)
  await start(page)
  await firstNote(page)
  const midi = await page.evaluate(() => {
    const ns = (window as any).__piFixture.noteXs().filter((n: { y: number }) => n.y > 0)
    return ns.sort((a: { y: number }, b: { y: number }) => b.y - a.y)[0].midi as number
  })
  await page.locator(GAME).focus()
  await page.keyboard.press(MIDI_TO_QWERTY[midi])
  await expect(page.locator(`${GAME} .pi-hud-score .pi-hud-value`)).toHaveText('000010', { timeout: 5_000 })
})

test('falling note x equals its key x within 2 px when the container is offset', async ({ page }) => {
  await open(page)
  await start(page)
  // wait for a note that has travelled most of the way down (its x has finished lerping)
  await page.waitForFunction(() => (window as any).__piFixture.noteXs().some((n: { y: number }) => n.y > 200), null, { timeout: 30_000 })
  const m = await page.evaluate(() => {
    const f = (window as any).__piFixture
    const n = f.noteXs().filter((x: { y: number }) => x.y > 200).sort((a: { y: number }, b: { y: number }) => b.y - a.y)[0]
    return { noteX: n.x as number, keyX: f.keyX(n.midi) as number }
  })
  expect(Math.abs(m.noteX - m.keyX)).toBeLessThanOrEqual(2)
})

test('no console errors during 5 s of play', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', e => errors.push(String(e)))
  await open(page)
  await start(page)
  await page.waitForTimeout(5_000)
  expect(errors).toEqual([])
})
