import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadOpenSongsIndex, loadOpenSong, OPENSONGS_BASE_URL } from '../../src/song/opensongs'
import { SongError } from '../../src/song/errors'

const fx = (n: string) => path.join(__dirname, '../fixtures', n)
const index = JSON.parse(fs.readFileSync(fx('opensongs-index.json'), 'utf8'))
const okJson = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch

describe('OpenSongs index', () => {
  it('maps entries with absolute musicxmlUrl and crf difficulty mapping (1,2→easy; 3→intermediate; 5→advanced)', async () => {
    const f = okJson(index)
    const entries = await loadOpenSongsIndex({ fetchImpl: f })
    expect(f).toHaveBeenCalledWith(OPENSONGS_BASE_URL + 'index.json')
    expect(entries).toHaveLength(4)
    const hcb = entries.find(e => e.id === 'hot-cross-buns')!
    expect(hcb.musicxmlUrl).toBe(OPENSONGS_BASE_URL + 'songs/hot-cross-buns/song.musicxml')
    expect(hcb.title).toBe('Hot Cross Buns')
    expect(hcb.timeSignature).toEqual([4, 4])
    expect(entries.map(e => [e.level, e.difficulty])).toEqual([
      [1, 'easy'], [2, 'easy'], [3, 'intermediate'], [5, 'advanced'],
    ])
  })

  it('entries sorted by level then title', async () => {
    const dup = { ...index.songs.find((x: { id: string }) => x.id === 'hot-cross-buns'), id: 'aaa', title: 'AAA' }
    const entries = await loadOpenSongsIndex({ fetchImpl: okJson({ ...index, songs: [...index.songs, dup] }) })
    expect(entries.map(e => e.title)).toEqual([
      'AAA', 'Hot Cross Buns', 'Old MacDonald Had a Farm', 'Scarborough Fair', 'Caprice No. 24 (theme)',
    ])
  })

  it('custom baseUrl is used', async () => {
    const f = okJson(index)
    const entries = await loadOpenSongsIndex({ baseUrl: 'https://example.test/lib', fetchImpl: f })
    expect(f).toHaveBeenCalledWith('https://example.test/lib/index.json')
    expect(entries[0].musicxmlUrl.startsWith('https://example.test/lib/songs/')).toBe(true)
  })

  it('index 500 → SongError score-load', async () => {
    const f = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    await expect(loadOpenSongsIndex({ fetchImpl: f })).rejects.toMatchObject({ code: 'score-load' })
    await expect(loadOpenSongsIndex({ fetchImpl: f })).rejects.toBeInstanceOf(SongError)
  })

  it('loadOpenSong fetches the musicxml url and returns a GameSong titled from the entry', async () => {
    const xml = fs.readFileSync(fx('leadsheet-then-piano.musicxml'), 'utf8')
    const f = vi.fn(async () => new Response(xml, { status: 200 })) as unknown as typeof fetch
    const [entry] = await loadOpenSongsIndex({ fetchImpl: okJson(index) })
    const song = await loadOpenSong(entry, { fetchImpl: f })
    expect(f).toHaveBeenCalledWith(entry.musicxmlUrl)
    expect(song.title).toBe(entry.title)
    expect(song.difficulty).toBe('easy')
    expect(song.targets.length).toBeGreaterThan(0)
  })
})
