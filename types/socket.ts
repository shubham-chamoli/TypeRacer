export interface RoomConfig {
  timeLimit: 15 | 30 | 60
  difficulty: "easy" | "normal" | "hard"
  wordCount: 50 | 100 | 200
}

export interface PlayerInfo {
  id: string
  name: string
  image: string | null
}

export interface RoomState {
  code: string
  hostId: string
  players: PlayerInfo[]
  config: RoomConfig
  status: "waiting" | "countdown" | "playing" | "finished"
}

export interface LeaderboardEntry {
  playerId: string
  playerName: string
  wpm: number
  accuracy: number
  progress: number
  finished: boolean
}

export interface GameResult {
  playerId: string
  playerName: string
  playerImage: string | null
  wpm: number
  rawWpm: number
  accuracy: number
  placement: number
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  message: string
  timestamp: number
}

export interface DirectMessage {
  id: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  message: string
  timestamp: number
}

export interface ClientToServerEvents {
  "room:create": (
    config: RoomConfig,
    callback: (response: { success: true; code: string; room: RoomState } | { success: false; error: string }) => void
  ) => void

  "room:join": (
    data: { code: string },
    callback: (response: { success: true; room: RoomState } | { success: false; error: string }) => void
  ) => void

  "room:leave": () => void

  "room:update-config": (config: Partial<RoomConfig>) => void

  "room:kick": (data: { playerId: string }) => void

  "room:start": () => void

  "room:reset": () => void

  "game:progress": (data: {
    wordIndex: number
    wpm: number
    accuracy: number
    progress: number
  }) => void

  "game:finish": (data: {
    wpm: number
    rawWpm: number
    accuracy: number
    correctChars: number
    incorrectChars: number
    extraChars: number
  }) => void

  "chat:send": (data: { message: string }) => void

  "friend:invite-to-room": (data: { friendId: string; roomCode: string }) => void

  "friends:get-online-status": (
    data: { friendIds: string[] },
    callback: (response: { onlineIds: string[] }) => void
  ) => void

  "friends:get-presence": (
    data: { friendIds: string[] },
    callback: (response: { entries: Array<{ friendId: string; online: boolean; hostRoomCode: string | null }> }) => void
  ) => void

  "dm:send": (data: { toUserId: string; message: string }) => void

  "dm:get-history": (
    data: { friendId: string },
    callback: (response: { messages: DirectMessage[] }) => void
  ) => void
}

export interface ServerToClientEvents {
  "room:player-joined": (data: { player: PlayerInfo }) => void
  "room:player-left": (data: { playerId: string; newHostId?: string }) => void
  "room:config-updated": (data: { config: RoomConfig }) => void
  "room:dissolved": (data: { reason: string }) => void
  "room:reset-to-lobby": () => void

  "game:countdown": (data: { count: number }) => void
  "game:start": (data: { words: string[] }) => void
  "game:leaderboard": (data: { players: LeaderboardEntry[] }) => void
  "game:player-finished": (data: { playerId: string; placement: number; wpm: number }) => void
  "game:end": (data: { results: GameResult[]; matchId: string }) => void
  "match:over": (data: { results: GameResult[]; matchId: string }) => void

  "chat:message": (data: ChatMessage) => void

  "notification:room-invite": (data: { fromUserId: string; fromUserName: string; roomCode: string }) => void

  "dm:message": (data: DirectMessage) => void

  error: (data: { message: string }) => void
}

export interface SocketData {
  userId: string
  userName: string
  userImage: string | null
}
