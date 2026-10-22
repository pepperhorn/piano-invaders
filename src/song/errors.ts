export type SongErrorCode = 'score-load' | 'score-parse';

export class SongError extends Error {
  code: SongErrorCode;
  constructor(code: SongErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SongError';
    this.code = code;
  }
}
