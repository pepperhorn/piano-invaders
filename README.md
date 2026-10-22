# Piano Invaders

A retro rhythm game: Space Invaders meets piano. Notes fall from a UFO; press the matching piano key (click, tap, or QWERTY) to shoot each one before it bombs your land strip. Missed notes cost HP; the game ends at 0 HP or when you quit.

- **Songs:** MusicXML first (plus MXL, MIDI and dottl v5-v7), the [OpenSongs](https://github.com/pepperhorn/opensongs-json) library in the song roller, and file import.
- **Controls:** the 18-key keyboard (B2-E4) with Ableton-style QWERTY: A S D F G H J K L for white keys, E R Y U I P [ for sharps.
- **Scoring:** +10 per hit, -5 HP per missed note. TOTAL = score x (HP/100 + 1) x (BPM / 65) x (1 + minutes) x difficulty (easy x1, intermediate x2, advanced x3).

## Run it

```bash
npm install
npm run dev -- --host 0.0.0.0   # app at /, embed fixture at /embed.html
npm test                        # unit tests
npm run test:e2e                # Playwright against the embed fixture
npm run build                   # standalone app -> dist/
npm run build:lib               # ESM library -> lib/
```

## Embed it

```tsx
import PianoInvaders from 'piano-invaders'
import 'piano-invaders/style.css'

<PianoInvaders musicXml={xml} difficulty={2} />
```

See [EMBEDDING_GUIDE.md](EMBEDDING_GUIDE.md) for props, fonts, CSP and an Astro example, and [CLAUDE.md](CLAUDE.md) for the architecture.

Song format: [dottl](https://github.com/pepperhorn/dottl-spec).

## License

MIT — see [LICENSE](LICENSE).
