"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { Socket } from "socket.io-client"
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  RoomConfig,
  PlayerInfo,
  LeaderboardEntry,
  GameResult,
  ChatMessage,
} from "@/types/socket"

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type RoomStatus = "waiting" | "countdown" | "playing" | "finished"

interface UseRoomReturn {
  room: RoomState | null
  countdown: number | null
  words: string[]
  leaderboard: LeaderboardEntry[]
  results: GameResult[]
  matchId: string | null
  chatMessages: ChatMessage[]
  error: string | null
  isLoading: boolean
  createRoom: (config: RoomConfig) => Promise<string | null>
  joinRoom: (code: string) => Promise<boolean>
  leaveRoom: () => void
  updateConfig: (config: Partial<RoomConfig>) => void
  kickPlayer: (playerId: string) => void
  startGame: () => void
  resetToLobby: () => void
  sendChat: (message: string) => void
  emitProgress: (data: { wordIndex: number; wpm: number; accuracy: number; progress: number }) => void
  emitFinish: (data: {
    wpm: number
    rawWpm: number
    accuracy: number
    correctChars: number
    incorrectChars: number
    extraChars: number
  }) => void
}

export function useRoom(socket: TypedSocket | null, isConnected: boolean): UseRoomReturn {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [words, setWords] = useState<string[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [results, setResults] = useState<GameResult[]>([])
  const [matchId, setMatchId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const hasFinishedRef = useRef(false)

  // Register socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return

    function onPlayerJoined(data: { player: PlayerInfo }) {
      setRoom((prev) => {
        if (!prev) return prev
        if (prev.players.some((p) => p.id === data.player.id)) return prev
        return { ...prev, players: [...prev.players, data.player] }
      })
    }

    function onPlayerLeft(data: { playerId: string; newHostId?: string }) {
      setRoom((prev) => {
        if (!prev) return prev
        const updated = {
          ...prev,
          players: prev.players.filter((p) => p.id !== data.playerId),
        }
        if (data.newHostId) {
          updated.hostId = data.newHostId
        }
        return updated
      })
      setLeaderboard((prev) => prev.filter((e) => e.playerId !== data.playerId))
    }

    function onConfigUpdated(data: { config: RoomConfig }) {
      setRoom((prev) => {
        if (!prev) return prev
        return { ...prev, config: data.config }
      })
    }

    function onDissolved(data: { reason: string }) {
      setError(data.reason)
      setRoom(null)
      setCountdown(null)
      setWords([])
      setLeaderboard([])
      setResults([])
      setMatchId(null)
      setChatMessages([])
    }

    function onResetToLobby() {
      hasFinishedRef.current = false
      setCountdown(null)
      setWords([])
      setLeaderboard([])
      setResults([])
      setMatchId(null)
      setRoom((prev) => {
        if (!prev) return prev
        return { ...prev, status: "waiting" }
      })
    }

    function onCountdown(data: { count: number }) {
      setCountdown(data.count)
      setRoom((prev) => {
        if (!prev) return prev
        return { ...prev, status: "countdown" }
      })
    }

    function onGameStart(data: { words: string[] }) {
      setWords(data.words)
      setCountdown(null)
      setResults([])
      setMatchId(null)
      hasFinishedRef.current = false
      setRoom((prev) => {
        if (!prev) return prev
        return { ...prev, status: "playing" }
      })
    }

    function onLeaderboard(data: { players: LeaderboardEntry[] }) {
      setLeaderboard(data.players)
    }

    function onPlayerFinished(data: { playerId: string; placement: number; wpm: number }) {
      setLeaderboard((prev) =>
        prev.map((entry) =>
          entry.playerId === data.playerId
            ? { ...entry, finished: true, wpm: data.wpm }
            : entry
        )
      )
    }

    function onGameEnd(data: { results: GameResult[]; matchId: string }) {
      setResults(data.results)
      setMatchId(data.matchId)
      setRoom((prev) => {
        if (!prev) return prev
        return { ...prev, status: "finished" }
      })
    }

    function onMatchOver(data: { results: GameResult[]; matchId: string }) {
      onGameEnd(data)
    }

    function onChatMessage(data: ChatMessage) {
      setChatMessages((prev) => [...prev, data])
    }

    function onError(data: { message: string }) {
      setError(data.message)
    }

    socket.on("room:player-joined", onPlayerJoined)
    socket.on("room:player-left", onPlayerLeft)
    socket.on("room:config-updated", onConfigUpdated)
    socket.on("room:dissolved", onDissolved)
    socket.on("room:reset-to-lobby", onResetToLobby)
    socket.on("game:countdown", onCountdown)
    socket.on("game:start", onGameStart)
    socket.on("game:leaderboard", onLeaderboard)
    socket.on("game:player-finished", onPlayerFinished)
    socket.on("game:end", onGameEnd)
    socket.on("match:over", onMatchOver)
    socket.on("chat:message", onChatMessage)
    socket.on("error", onError)

    return () => {
      socket.off("room:player-joined", onPlayerJoined)
      socket.off("room:player-left", onPlayerLeft)
      socket.off("room:config-updated", onConfigUpdated)
      socket.off("room:dissolved", onDissolved)
      socket.off("room:reset-to-lobby", onResetToLobby)
      socket.off("game:countdown", onCountdown)
      socket.off("game:start", onGameStart)
      socket.off("game:leaderboard", onLeaderboard)
      socket.off("game:player-finished", onPlayerFinished)
      socket.off("game:end", onGameEnd)
      socket.off("match:over", onMatchOver)
      socket.off("chat:message", onChatMessage)
      socket.off("error", onError)
    }
  }, [socket, isConnected])

  const createRoom = useCallback(
    async (config: RoomConfig): Promise<string | null> => {
      if (!socket || !isConnected) {
        setError("Not connected to server")
        return null
      }

      setIsLoading(true)
      setError(null)

      return new Promise((resolve) => {
        socket.emit("room:create", config, (response) => {
          setIsLoading(false)
          if (response.success) {
            setRoom(response.room)
            setChatMessages([])
            setLeaderboard([])
            setResults([])
            setMatchId(null)
            resolve(response.code)
          } else {
            setError(response.error)
            resolve(null)
          }
        })
      })
    },
    [socket, isConnected]
  )

  const joinRoom = useCallback(
    async (code: string): Promise<boolean> => {
      if (!socket || !isConnected) {
        setError("Not connected to server")
        return false
      }

      setIsLoading(true)
      setError(null)

      return new Promise((resolve) => {
        socket.emit("room:join", { code }, (response) => {
          setIsLoading(false)
          if (response.success) {
            setRoom(response.room)
            setChatMessages([])
            setLeaderboard([])
            setResults([])
            setMatchId(null)
            resolve(true)
          } else {
            setError(response.error)
            resolve(false)
          }
        })
      })
    },
    [socket, isConnected]
  )

  const leaveRoom = useCallback(() => {
    if (!socket || !isConnected) return
    socket.emit("room:leave")
    setRoom(null)
    setCountdown(null)
    setWords([])
    setLeaderboard([])
    setResults([])
    setMatchId(null)
    setChatMessages([])
    setError(null)
  }, [socket, isConnected])

  const updateConfig = useCallback(
    (config: Partial<RoomConfig>) => {
      if (!socket || !isConnected) return
      socket.emit("room:update-config", config)
    },
    [socket, isConnected]
  )

  const kickPlayer = useCallback(
    (playerId: string) => {
      if (!socket || !isConnected) return
      socket.emit("room:kick", { playerId })
    },
    [socket, isConnected]
  )

  const startGame = useCallback(() => {
    if (!socket || !isConnected) return
    socket.emit("room:start")
  }, [socket, isConnected])

  const resetToLobby = useCallback(() => {
    if (!socket || !isConnected) return
    socket.emit("room:reset")
  }, [socket, isConnected])

  const sendChat = useCallback(
    (message: string) => {
      if (!socket || !isConnected || !message.trim()) return
      socket.emit("chat:send", { message: message.trim() })
    },
    [socket, isConnected]
  )

  const emitProgress = useCallback(
    (data: { wordIndex: number; wpm: number; accuracy: number; progress: number }) => {
      if (!socket || !isConnected) return
      socket.emit("game:progress", data)
    },
    [socket, isConnected]
  )

  const emitFinish = useCallback(
    (data: {
      wpm: number
      rawWpm: number
      accuracy: number
      correctChars: number
      incorrectChars: number
      extraChars: number
    }) => {
      if (!socket || !isConnected || hasFinishedRef.current) return
      hasFinishedRef.current = true
      socket.emit("game:finish", data)
    },
    [socket, isConnected]
  )

  return {
    room,
    countdown,
    words,
    leaderboard,
    results,
    matchId,
    chatMessages,
    error,
    isLoading,
    createRoom,
    joinRoom,
    leaveRoom,
    updateConfig,
    kickPlayer,
    startGame,
    resetToLobby,
    sendChat,
    emitProgress,
    emitFinish,
  }
}
