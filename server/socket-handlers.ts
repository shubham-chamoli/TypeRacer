import { Server, Socket } from "socket.io"
import crypto from "crypto"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { eq } from "drizzle-orm"
import { matches, matchResults, userStats } from "../db/schema"
import type { ClientToServerEvents, ServerToClientEvents, SocketData, GameResult, DirectMessage } from "../types/socket"
import { roomManager } from "./room-manager"
import { generateWords } from "../lib/words"
import type { Difficulty } from "../lib/words"
import path from "path"

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

const dbPath = path.join(process.cwd(), "db", "dev.db")
const sqlite = new Database(dbPath)
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")
const db = drizzle(sqlite, { schema: { matches, matchResults, userStats } })

const onlineUsers = new Map<string, string>()
const directMessageHistory = new Map<string, DirectMessage[]>()
const MAX_DIRECT_MESSAGES = 100

// Throttle map for leaderboard broadcasts
const leaderboardThrottles = new Map<string, number>()
const LEADERBOARD_THROTTLE_MS = 300

function getDirectMessageKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join(":")
}

export function registerHandlers(io: TypedIO, socket: TypedSocket) {
  const userId = socket.data.userId
  const userName = socket.data.userName
  const userImage = socket.data.userImage

  // Track online status
  onlineUsers.set(userId, socket.id)

  // === ROOM EVENTS ===

  socket.on("room:create", (config, callback) => {
    try {
      const room = roomManager.createRoom(
        userId,
        socket.id,
        { id: userId, name: userName, image: userImage },
        config
      )
      socket.join(room.code)
      callback({ success: true, code: room.code, room: roomManager.getRoomState(room) })
    } catch (err) {
      callback({ success: false, error: "Failed to create room" })
    }
  })

  socket.on("room:join", (data, callback) => {
    try {
      const room = roomManager.joinRoom(
        data.code,
        userId,
        socket.id,
        { id: userId, name: userName, image: userImage }
      )
      if (!room) {
        callback({ success: false, error: "Room not found or not joinable" })
        return
      }
      socket.join(room.code)
      socket.to(room.code).emit("room:player-joined", {
        player: { id: userId, name: userName, image: userImage },
      })
      callback({ success: true, room: roomManager.getRoomState(room) })
    } catch (err) {
      callback({ success: false, error: "Failed to join room" })
    }
  })

  socket.on("room:leave", () => {
    const { room, dissolved, newHostId } = roomManager.leaveRoom(socket.id)
    if (dissolved) {
      io.to(socket.id).emit("room:dissolved", { reason: "All players left" })
      return
    }
    if (room) {
      socket.leave(room.code)
      io.to(room.code).emit("room:player-left", { playerId: userId, newHostId })
    }
  })

  socket.on("room:update-config", (config) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) return
    const updated = roomManager.updateConfig(room.code, userId, config)
    if (updated) {
      io.to(room.code).emit("room:config-updated", { config: updated.config })
    }
  })

  socket.on("room:kick", (data) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room || room.hostId !== userId) return

    const result = roomManager.removePlayerById(room.code, data.playerId)
    if (result) {
      const kickedSocket = io.sockets.sockets.get(result.socketId)
      if (kickedSocket) {
        kickedSocket.emit("room:dissolved", { reason: "You were kicked from the room" })
        kickedSocket.leave(room.code)
      }
      io.to(room.code).emit("room:player-left", { playerId: data.playerId, newHostId: result.newHostId })
    }
  })

  socket.on("room:start", () => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room || room.hostId !== userId) return
    if (room.status !== "waiting" && room.status !== "finished") return

    roomManager.setRoomStatus(room.code, "countdown")

    let count = 3
    const countdownInterval = setInterval(() => {
      io.to(room.code).emit("game:countdown", { count })
      count--
      if (count < 0) {
        clearInterval(countdownInterval)

        // Generate words and start the game
        const words = generateWords(room.config.wordCount, room.config.difficulty as Difficulty)
        roomManager.initGameState(room.code, words)
        roomManager.setRoomStatus(room.code, "playing")

        io.to(room.code).emit("game:start", { words })
        if (room.gameState) {
          io.to(room.code).emit("game:leaderboard", { players: room.gameState.leaderboard })
        }

        // Server-side game timer (timeLimit + 2s grace)
        const timeout = (room.config.timeLimit + 2) * 1000
        room.gameTimer = setTimeout(() => {
          endGame(io, room.code)
        }, timeout)
      }
    }, 1000)

    room.countdownTimer = countdownInterval as unknown as ReturnType<typeof setTimeout>
  })

  socket.on("room:reset", () => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room || room.hostId !== userId) return
    if (room.status !== "finished") return

    roomManager.setRoomStatus(room.code, "waiting")
    room.gameState = null
    room.countdownTimer = null
    room.gameTimer = null
    io.to(room.code).emit("room:reset-to-lobby")
  })

  // === GAME EVENTS ===

  socket.on("game:progress", (data) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room || room.status !== "playing") return

    const leaderboard = roomManager.updateLeaderboardEntry(room.code, userId, {
      wpm: data.wpm,
      accuracy: data.accuracy,
      progress: data.progress,
    })

    if (leaderboard) {
      const now = Date.now()
      const lastBroadcast = leaderboardThrottles.get(room.code) || 0
      if (now - lastBroadcast >= LEADERBOARD_THROTTLE_MS) {
        leaderboardThrottles.set(room.code, now)
        io.to(room.code).emit("game:leaderboard", { players: leaderboard })
      }
    }
  })

  socket.on("game:finish", (data) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room || room.status !== "playing" || !room.gameState) return

    if (room.gameState.finishedPlayers.has(userId)) return

    const currentFinished = roomManager.getFinishedCount(room.code)
    const placement = currentFinished + 1

    const result: GameResult = {
      playerId: userId,
      playerName: userName,
      playerImage: userImage,
      wpm: data.wpm,
      rawWpm: data.rawWpm,
      accuracy: data.accuracy,
      placement,
    }

    const allFinished = roomManager.addFinishedPlayer(room.code, userId, result)

    io.to(room.code).emit("game:player-finished", {
      playerId: userId,
      placement,
      wpm: data.wpm,
    })

    // Broadcast updated leaderboard
    if (room.gameState) {
      io.to(room.code).emit("game:leaderboard", { players: room.gameState.leaderboard })
    }

    if (allFinished) {
      endGame(io, room.code)
    }
  })

  // === CHAT EVENTS ===

  socket.on("chat:send", (data) => {
    const room = roomManager.getRoomBySocket(socket.id)
    if (!room) return

    const message = {
      id: crypto.randomUUID(),
      senderId: userId,
      senderName: userName,
      message: data.message.slice(0, 500),
      timestamp: Date.now(),
    }

    io.to(room.code).emit("chat:message", message)
  })

  // === FRIEND INVITE EVENTS ===

  socket.on("friend:invite-to-room", (data) => {
    const targetSocketId = onlineUsers.get(data.friendId)
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId)
      if (targetSocket) {
        targetSocket.emit("notification:room-invite", {
          fromUserId: userId,
          fromUserName: userName,
          roomCode: data.roomCode,
        })
      }
    }
  })

  socket.on("friends:get-online-status", (data, callback) => {
    const onlineIds = data.friendIds.filter((friendId) => onlineUsers.has(friendId))
    callback({ onlineIds })
  })

  socket.on("friends:get-presence", (data, callback) => {
    const entries = data.friendIds.map((friendId) => {
      const online = onlineUsers.has(friendId)
      return {
        friendId,
        online,
        hostRoomCode: online ? roomManager.getJoinableRoomCodeByHostId(friendId) : null,
      }
    })
    callback({ entries })
  })

  // === DIRECT MESSAGE EVENTS ===

  socket.on("dm:send", (data) => {
    const messageText = data.message.trim().slice(0, 500)
    if (!data.toUserId || messageText.length === 0) return

    const message: DirectMessage = {
      id: crypto.randomUUID(),
      fromUserId: userId,
      fromUserName: userName,
      toUserId: data.toUserId,
      message: messageText,
      timestamp: Date.now(),
    }

    const key = getDirectMessageKey(userId, data.toUserId)
    const previous = directMessageHistory.get(key) || []
    const next = [...previous, message].slice(-MAX_DIRECT_MESSAGES)
    directMessageHistory.set(key, next)

    socket.emit("dm:message", message)

    const targetSocketId = onlineUsers.get(data.toUserId)
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId)
      targetSocket?.emit("dm:message", message)
    }
  })

  socket.on("dm:get-history", (data, callback) => {
    const key = getDirectMessageKey(userId, data.friendId)
    callback({ messages: directMessageHistory.get(key) || [] })
  })

  // === DISCONNECT ===

  socket.on("disconnect", () => {
    console.log(`[Socket] ${userName} disconnected (${socket.id})`)
    onlineUsers.delete(userId)

    const { room, dissolved, newHostId } = roomManager.leaveRoom(socket.id)
    if (dissolved) return
    if (room) {
      io.to(room.code).emit("room:player-left", { playerId: userId, newHostId })
    }
  })
}

// === END GAME LOGIC ===

async function endGame(io: TypedIO, code: string) {
  const room = roomManager.getRoom(code)
  if (!room || room.status === "finished") return
  if (!room.gameState) return

  roomManager.setRoomStatus(code, "finished")

  if (room.gameTimer) {
    clearTimeout(room.gameTimer)
    room.gameTimer = null
  }

  leaderboardThrottles.delete(code)

  // Build final results sorted by WPM
  const results: GameResult[] = []
  const leaderboard = room.gameState.leaderboard

  // Sort by WPM descending
  leaderboard.sort((a, b) => b.wpm - a.wpm)

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i]
    const existing = room.gameState.finishedPlayers.get(entry.playerId)
    results.push({
      playerId: entry.playerId,
      playerName: entry.playerName,
      playerImage: room.players.get(entry.playerId)?.info.image ?? null,
      wpm: existing?.wpm ?? entry.wpm,
      rawWpm: existing?.rawWpm ?? entry.wpm,
      accuracy: existing?.accuracy ?? entry.accuracy,
      placement: i + 1,
    })
  }

  // Persist to database
  let matchId = ""
  try {
    const [match] = await db.insert(matches).values({
      roomCode: code,
      difficulty: room.config.difficulty,
      timeLimit: room.config.timeLimit,
      wordsSeed: JSON.stringify(room.gameState.words.slice(0, 50)),
      playerCount: room.players.size,
      startedAt: new Date(room.gameState.startTime),
      endedAt: new Date(),
    }).returning()
    matchId = match.id

    for (const result of results) {
      await db.insert(matchResults).values({
        matchId: match.id,
        userId: result.playerId,
        wpm: result.wpm,
        rawWpm: result.rawWpm,
        accuracy: result.accuracy,
        placement: result.placement,
      })

      // Update user stats
      const existing = await db.query.userStats.findFirst({
        where: eq(userStats.userId, result.playerId),
      })

      if (existing) {
        const newTotalGames = existing.totalGames + 1
        const newAverageWpm =
          (existing.averageWpm * existing.totalGames + result.wpm) / newTotalGames

        await db.update(userStats)
          .set({
            totalGames: newTotalGames,
            bestWpm: Math.max(existing.bestWpm, result.wpm),
            averageWpm: Math.round(newAverageWpm * 10) / 10,
            totalWins: result.placement === 1 ? existing.totalWins + 1 : existing.totalWins,
          })
          .where(eq(userStats.userId, result.playerId))
      } else {
        await db.insert(userStats).values({
          userId: result.playerId,
          totalGames: 1,
          bestWpm: result.wpm,
          averageWpm: result.wpm,
          totalWins: result.placement === 1 ? 1 : 0,
        })
      }
    }
  } catch (err) {
    console.error("[Game] Failed to persist match results:", err)
  }

  io.to(code).emit("game:end", { results, matchId })
  io.to(code).emit("match:over", { results, matchId })
}
