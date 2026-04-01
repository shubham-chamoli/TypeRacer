export type MultiplayerTestState = "waiting" | "countdown" | "running" | "finished"

export interface PlayerProgress {
  playerId: string
  wpm: number
  accuracy: number
  progress: number
  finished: boolean
  wordIndex: number
}
