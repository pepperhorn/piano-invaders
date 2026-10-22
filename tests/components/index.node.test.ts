// @vitest-environment node
import { it, expect } from 'vitest'

it('importing no module touches window', async () => {
  expect(typeof window).toBe('undefined')
  const mod = await import('../../src/index')
  expect(typeof mod.PianoInvaders).toBe('function')
  expect(mod.default).toBe(mod.PianoInvaders)
  expect(typeof mod.loadSong).toBe('function')
  expect(typeof mod.dottlToGameSong).toBe('function')
  expect(typeof mod.gameSongToDottl).toBe('function')
  expect(typeof mod.isDottl).toBe('function')
  expect(typeof mod.scoreToGameSong).toBe('function')
  expect(typeof window).toBe('undefined')
})
