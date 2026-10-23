// Library entry. Importing this module has no side effects on the host (no window /
// document / localStorage access, no AudioContext). Styles: import 'piano-invaders/style.css'.
import PianoInvaders from './components/PianoInvaders'

export { PianoInvaders }
export default PianoInvaders

export type { PianoInvadersProps, GameStats, PianoInvadersError, ErrorCode } from './components/PianoInvaders'
export type { LeaderboardEntry, LeaderboardAdapter } from './utils/leaderboard'
export type { PianoInvadersPlugin, PluginTheme } from './plugins/PluginRegistry'

export { loadSong } from './song/load'
export { padCountIn } from './song/pad'
export { loadOpenSongsIndex, loadOpenSong, OPENSONGS_BASE_URL } from './song/opensongs'
export type { OpenSongEntry } from './song/opensongs'
export { dottlToGameSong, gameSongToDottl, isDottl } from './song/dottl'
export { scoreToGameSong } from './song/fromScore'
export { SongError } from './song/errors'
export type { GameSong, ScoreSource, Difficulty, Target, AccompNote, VoiceInfo } from './song/types'
