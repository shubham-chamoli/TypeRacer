import type { RoomConfig, PlayerInfo, LeaderboardEntry, GameResult, RoomState } from "../types/socket"

interface PlayerEntry {
  socketId: string
  info: PlayerInfo
  disconnectedAt: number | null
}

interface GameState {
  startTime: number
  finishedPlayers: Map<string, GameResult>
  leaderboard: LeaderboardEntry[]
  words: string[]
}

interface Room {
  code: string
  hostId: string
  config: RoomConfig
  status: "waiting" | "countdown" | "playing" | "finished"
  players: Map<string, PlayerEntry>
  gameState: GameState | null
  countdownTimer: ReturnType<typeof setTimeout> | null
  gameTimer: ReturnType<typeof setTimeout> | null
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

class RoomManager {
  private rooms = new Map<string, Room>()
  private playerRooms = new Map<string, string>()

  generateCode(): string {
    let code: string
    do {
      code = ""
      for (let i = 0; i < 4; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
      }
    } while (this.rooms.has(code))
    return code
  }

  createRoom(hostId: string, socketId: string, hostInfo: PlayerInfo, config: RoomConfig): Room {
    const code = this.generateCode()
    const room: Room = {
      code,
      hostId,
      config,
      status: "waiting",
      players: new Map(),
      gameState: null,
      countdownTimer: null,
      gameTimer: null,
    }
    room.players.set(hostId, { socketId, info: hostInfo, disconnectedAt: null })
    this.rooms.set(code, room)
    this.playerRooms.set(socketId, code)
    return room
  }

  joinRoom(code: string, playerId: string, socketId: string, playerInfo: PlayerInfo): Room | null {
    const room = this.rooms.get(code.toUpperCase())
    if (!room) return null
    if (room.status !== "waiting") return null
    if (room.players.size >= 8) return null

    // Idempotent join for existing player (e.g. host navigating from lobby to room page).
    if (room.players.has(playerId)) {
      const entry = room.players.get(playerId)
      if (entry) {
        this.playerRooms.delete(entry.socketId)
        entry.socketId = socketId
        entry.info = playerInfo
        entry.disconnectedAt = null
      }
      this.playerRooms.set(socketId, room.code)
      return room
    }

    room.players.set(playerId, { socketId, info: playerInfo, disconnectedAt: null })
    this.playerRooms.set(socketId, code)
    return room
  }

  leaveRoom(socketId: string): { room: Room | null; dissolved: boolean; newHostId?: string } {
    const code = this.playerRooms.get(socketId)
    if (!code) return { room: null, dissolved: false }

    const room = this.rooms.get(code)
    if (!room) {
      this.playerRooms.delete(socketId)
      return { room: null, dissolved: false }
    }

    let leavingPlayerId: string | null = null
    for (const [playerId, entry] of room.players) {
      if (entry.socketId === socketId) {
        leavingPlayerId = playerId
        break
      }
    }

    if (!leavingPlayerId) {
      this.playerRooms.delete(socketId)
      return { room, dissolved: false }
    }

    room.players.delete(leavingPlayerId)
    this.playerRooms.delete(socketId)

    if (room.players.size === 0) {
      this.dissolveRoom(code)
      return { room: null, dissolved: true }
    }

    let newHostId: string | undefined
    if (leavingPlayerId === room.hostId) {
      const firstPlayer = room.players.keys().next().value
      if (firstPlayer) {
        room.hostId = firstPlayer
        newHostId = firstPlayer
      }
    }

    return { room, dissolved: false, newHostId }
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase())
  }

  getRoomBySocket(socketId: string): Room | undefined {
    const code = this.playerRooms.get(socketId)
    if (!code) return undefined
    return this.rooms.get(code)
  }

  getJoinableRoomCodeByHostId(hostId: string): string | null {
    for (const room of this.rooms.values()) {
      if (room.hostId === hostId && room.status === "waiting") {
        return room.code
      }
    }
    return null
  }

  updateConfig(code: string, playerId: string, config: Partial<RoomConfig>): Room | null {
    const room = this.rooms.get(code)
    if (!room) return null
    if (room.hostId !== playerId) return null
    if (room.status !== "waiting") return null

    room.config = { ...room.config, ...config }
    return room
  }

  setRoomStatus(code: string, status: Room["status"]): void {
    const room = this.rooms.get(code)
    if (room) room.status = status
  }

  initGameState(code: string, words: string[]): void {
    const room = this.rooms.get(code)
    if (!room) return

    const leaderboard: LeaderboardEntry[] = []
    for (const [playerId, entry] of room.players) {
      leaderboard.push({
        playerId,
        playerName: entry.info.name,
        wpm: 0,
        accuracy: 100,
        progress: 0,
        finished: false,
      })
    }

    room.gameState = {
      startTime: Date.now(),
      finishedPlayers: new Map(),
      leaderboard,
      words,
    }
  }

  getPlayerSocketId(code: string, playerId: string): string | undefined {
    const room = this.rooms.get(code)
    if (!room) return undefined
    return room.players.get(playerId)?.socketId
  }

  getAllPlayerSocketIds(code: string): string[] {
    const room = this.rooms.get(code)
    if (!room) return []
    const ids: string[] = []
    for (const entry of room.players.values()) {
      if (entry.disconnectedAt === null) {
        ids.push(entry.socketId)
      }
    }
    return ids
  }

  updateLeaderboardEntry(code: string, playerId: string, data: { wpm: number; accuracy: number; progress: number }): LeaderboardEntry[] | null {
    const room = this.rooms.get(code)
    if (!room?.gameState) return null

    const entry = room.gameState.leaderboard.find((e) => e.playerId === playerId)
    if (entry && !entry.finished) {
      entry.wpm = data.wpm
      entry.accuracy = data.accuracy
      entry.progress = data.progress
    }

    room.gameState.leaderboard.sort((a, b) => b.wpm - a.wpm)
    return room.gameState.leaderboard
  }

  addFinishedPlayer(code: string, playerId: string, result: GameResult): boolean {
    const room = this.rooms.get(code)
    if (!room?.gameState) return false

    room.gameState.finishedPlayers.set(playerId, result)

    const entry = room.gameState.leaderboard.find((e) => e.playerId === playerId)
    if (entry) {
      entry.finished = true
      entry.wpm = result.wpm
      entry.accuracy = result.accuracy
      entry.progress = 100
    }

    room.gameState.leaderboard.sort((a, b) => b.wpm - a.wpm)

    return room.gameState.finishedPlayers.size >= room.players.size
  }

  getFinishedCount(code: string): number {
    const room = this.rooms.get(code)
    if (!room?.gameState) return 0
    return room.gameState.finishedPlayers.size
  }

  getRoomState(room: Room): RoomState {
    const players: PlayerInfo[] = []
    for (const entry of room.players.values()) {
      players.push(entry.info)
    }
    return {
      code: room.code,
      hostId: room.hostId,
      players,
      config: room.config,
      status: room.status,
    }
  }

  dissolveRoom(code: string): void {
    const room = this.rooms.get(code)
    if (!room) return

    if (room.countdownTimer) clearTimeout(room.countdownTimer)
    if (room.gameTimer) clearTimeout(room.gameTimer)

    for (const entry of room.players.values()) {
      this.playerRooms.delete(entry.socketId)
    }

    this.rooms.delete(code)
  }

  reconnectPlayer(code: string, playerId: string, newSocketId: string): boolean {
    const room = this.rooms.get(code)
    if (!room) return false

    const entry = room.players.get(playerId)
    if (!entry) return false

    const oldSocketId = entry.socketId
    this.playerRooms.delete(oldSocketId)

    entry.socketId = newSocketId
    entry.disconnectedAt = null
    this.playerRooms.set(newSocketId, code)
    return true
  }

  removePlayerById(code: string, playerId: string): { socketId: string; newHostId?: string } | null {
    const room = this.rooms.get(code)
    if (!room) return null

    const entry = room.players.get(playerId)
    if (!entry) return null

    const socketId = entry.socketId
    room.players.delete(playerId)
    this.playerRooms.delete(socketId)

    let newHostId: string | undefined
    if (playerId === room.hostId && room.players.size > 0) {
      const firstPlayer = room.players.keys().next().value
      if (firstPlayer) {
        room.hostId = firstPlayer
        newHostId = firstPlayer
      }
    }

    return { socketId, newHostId }
  }
}

export const roomManager = new RoomManager()
