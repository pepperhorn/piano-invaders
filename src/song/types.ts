export type Difficulty = 'easy' | 'intermediate' | 'advanced';
export interface Target { id: number; beat: number; midi: number; durBeats: number; group?: number } // group = chord-group id shared by ≤2 targets
export interface AccompNote { beat: number; midi: number; durBeats: number; velocity: number; voice: string }
export interface VoiceInfo { instrument: string; volume: number; percussion?: boolean }
export interface GameSong {
  id: string; title: string; bpm: number; beatsPerBar: number;
  timeSigChanges?: { beat: number; beatsPerBar: number }[];
  difficulty: Difficulty; targets: Target[]; accompaniment: AccompNote[];
  voices: Record<string, VoiceInfo>; lengthBeats: number;
  source: 'musicxml' | 'midi' | 'dottl' | 'legacy';
}
export type ScoreSource =
  | { musicXml: string } | { scoreUrl: string } | { file: File | Blob; name?: string }
  | { midi: ArrayBuffer } | { dottl: object | string };
