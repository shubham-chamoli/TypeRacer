"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useSocket } from "@/hooks/use-socket"
import { useRoom } from "@/hooks/use-room"
import { useMultiplayerTypingTest } from "@/hooks/use-multiplayer-typing-test"
import { TypingDisplay } from "@/components/typing-display"
import { InviteFriendDialog } from "@/components/multiplayer/invite-friend-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Crown,
  Copy,
  Check,
  Play,
  LogOut,
  Send,
  Loader2,
  WifiOff,
  UserX,
  Users,
  Clock,
  Activity,
  Zap,
  Target,
  Trophy,
  Medal,
  X,
} from "lucide-react"
import type { Difficulty } from "@/lib/words"

type TimerOption = 15 | 30 | 60

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string)?.toUpperCase()
  const { data: session, status: sessionStatus } = useSession()
  const { socket, isConnected, isConnecting, error: socketError } = useSocket()
  const {
    room,
    countdown,
    words,
    leaderboard,
    results,
    matchId,
    chatMessages,
    error: roomError,
    isLoading,
    joinRoom,
    leaveRoom,
    updateConfig,
    kickPlayer,
    startGame,
    resetToLobby,
    sendChat,
    emitProgress,
    emitFinish,
  } = useRoom(socket, isConnected)

  const [copied, setCopied] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [personalBest, setPersonalBest] = useState(0)
  const [isNewRecord, setIsNewRecord] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasJoinedRef = useRef(false)
  const previousCodeRef = useRef<string | null>(null)
  const currentUserId = session?.user?.id

  // Reset join-attempt guard when route code changes.
  useEffect(() => {
    if (previousCodeRef.current !== code) {
      hasJoinedRef.current = false
      previousCodeRef.current = code
    }
  }, [code])

  // Auto-join room for current route code.
  useEffect(() => {
    if (!isConnected || !code || isLoading) return

    // Already in the intended room.
    if (room?.code === code) return

    // If currently in a different room, leave first then retry join on next render.
    if (room && room.code !== code) {
      leaveRoom()
      hasJoinedRef.current = false
      return
    }

    if (hasJoinedRef.current) return

    hasJoinedRef.current = true
    joinRoom(code).then((success) => {
      if (!success) {
        hasJoinedRef.current = false
      }
    })
  }, [isConnected, code, room, isLoading, joinRoom, leaveRoom])

  // Use the multiplayer typing test hook
  const typingTest = useMultiplayerTypingTest({
    words,
    timeLimit: room?.config.timeLimit ?? 30,
    onProgress: emitProgress,
    onFinish: emitFinish,
  })

  // Start typing test when server sends game:start (words arrive + status becomes playing)
  useEffect(() => {
    if (room?.status === "playing" && words.length > 0 && typingTest.testState === "waiting") {
      typingTest.startTest()
    }
  }, [room?.status, words.length, typingTest.testState, typingTest.startTest])

  // Reset typing test when room goes back to waiting
  useEffect(() => {
    if (room?.status === "waiting" && typingTest.testState !== "waiting") {
      typingTest.resetTest()
    }
  }, [room?.status, typingTest.testState, typingTest.resetTest])

  useEffect(() => {
    if (room?.status !== "playing") return
    inputRef.current?.focus()
  }, [room?.status])

  useEffect(() => {
    if (room?.status !== "finished" || !currentUserId || results.length === 0) return
    const me = results.find((result) => result.playerId === currentUserId)
    if (!me) return

    const key = "typeracer:multiplayer-best-wpm"
    const previousBest = Number(window.localStorage.getItem(key) || 0)
    const nextBest = Math.max(previousBest, me.wpm)
    setPersonalBest(nextBest)
    setIsNewRecord(me.wpm > previousBest)

    if (nextBest !== previousBest) {
      window.localStorage.setItem(key, String(nextBest))
    }
  }, [room?.status, currentUserId, results])

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const isHost = room?.hostId === currentUserId

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim()) return
    sendChat(chatInput)
    setChatInput("")
  }

  function handleLeave() {
    leaveRoom()
    router.push("/multiplayer")
  }

  // --- Auth & connection guards ---
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <UserX className="text-primary" size={32} />
          <h1 className="text-2xl font-bold text-foreground">Sign In Required</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            You need to be signed in to join a multiplayer room.
          </p>
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (sessionStatus === "loading" || isConnecting) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
        <p className="mt-3 text-sm text-muted-foreground">
          {sessionStatus === "loading" ? "Loading session..." : "Connecting to server..."}
        </p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <WifiOff className="text-destructive" size={32} />
          <h1 className="text-2xl font-bold text-foreground">Connection Lost</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {socketError || "Unable to connect to the game server."}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Room error (dissolved, etc.)
  if (!room && !isLoading && hasJoinedRef.current) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Users className="text-muted-foreground" size={32} />
          <h1 className="text-2xl font-bold text-foreground">Room Not Found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {roomError || "This room may have been dissolved or does not exist."}
          </p>
          <Button asChild variant="outline">
            <Link href="/multiplayer">Back to Lobby</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Still loading / joining
  if (!room) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="mt-3 text-sm text-muted-foreground">Joining room...</p>
      </div>
    )
  }

  // --- WAITING STATE ---
  if (room.status === "waiting") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
          {/* Room Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Room</h1>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-lg font-bold tracking-widest transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                {code}
                {copied ? (
                  <Check size={16} className="text-emerald-400" />
                ) : (
                  <Copy size={16} className="text-muted-foreground" />
                )}
              </button>
            </div>
            <Button onClick={handleLeave} variant="outline" size="sm">
              <LogOut size={16} />
              Leave
            </Button>
            <InviteFriendDialog roomCode={code} socket={socket} />
          </div>

          {roomError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {roomError}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column: Players + Config */}
            <div className="flex flex-col gap-6 lg:col-span-1">
              {/* Players */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users size={16} />
                    Players ({room.players.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {room.players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={player.image || undefined} />
                          <AvatarFallback className="bg-primary/20 text-xs text-primary">
                            {player.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm font-medium">
                          {player.name}
                        </span>
                        {player.id === room.hostId && (
                          <Crown size={14} className="text-amber-400" />
                        )}
                        {isHost && player.id !== currentUserId && (
                          <button
                            onClick={() => kickPlayer(player.id)}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Kick player"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Config (host only) */}
              {isHost && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Room Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Difficulty
                      </label>
                      <div className="flex items-center rounded-xl border border-border bg-background p-1">
                        {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => updateConfig({ difficulty: d })}
                            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition-all ${
                              room.config.difficulty === d
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            } cursor-pointer`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Time Limit
                      </label>
                      <div className="flex items-center rounded-xl border border-border bg-background p-1">
                        {([15, 30, 60] as TimerOption[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => updateConfig({ timeLimit: t })}
                            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                              room.config.timeLimit === t
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            } cursor-pointer`}
                          >
                            {t}s
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Word Count
                      </label>
                      <div className="flex items-center rounded-xl border border-border bg-background p-1">
                        {([50, 100, 200] as const).map((count) => (
                          <button
                            key={count}
                            onClick={() => updateConfig({ wordCount: count })}
                            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                              room.config.wordCount === count
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            } cursor-pointer`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Config display (non-host) */}
              {!isHost && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Room Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {room.config.difficulty}
                      </Badge>
                      <Badge variant="secondary">
                        {room.config.timeLimit}s
                      </Badge>
                      <Badge variant="secondary">
                        {room.config.wordCount} words
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Start button (host only) */}
              {isHost && (
                <Button
                  onClick={startGame}
                  size="lg"
                  className="w-full"
                  disabled={room.players.length < 2}
                >
                  <Play size={18} />
                  {room.players.length < 2 ? "Need at least 2 players" : "Start Race"}
                </Button>
              )}

              {!isHost && (
                <p className="text-center text-sm text-muted-foreground">
                  Waiting for the host to start the race...
                </p>
              )}
            </div>

            {/* Right column: Chat */}
            <div className="lg:col-span-2">
              <Card className="flex h-[450px] flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send size={16} />
                    Chat
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
                  {/* Messages */}
                  <ScrollArea className="flex-1">
                    <div ref={chatScrollRef} className="flex flex-col gap-2 pr-4">
                      {chatMessages.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No messages yet. Say hi!
                        </p>
                      )}
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex gap-2">
                          <span className="shrink-0 text-xs font-semibold text-primary">
                            {msg.senderName}:
                          </span>
                          <span className="text-sm text-foreground break-all">
                            {msg.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Chat input */}
                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      maxLength={200}
                      className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!chatInput.trim()}>
                      <Send size={16} />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // --- COUNTDOWN STATE ---
  if (room.status === "countdown" && countdown !== null) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <p className="text-lg font-medium text-muted-foreground">Get ready!</p>
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary bg-primary/10">
            <span className="text-6xl font-bold tabular-nums text-primary animate-pulse">
              {countdown === 0 ? "GO" : countdown}
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {room.players.map((player) => (
              <Badge key={player.id} variant="secondary" className="gap-1.5 px-3 py-1">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={player.image || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {player.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {player.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --- PLAYING STATE ---
  if (room.status === "playing") {
    return (
      <div
        className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background text-foreground outline-none"
        tabIndex={-1}
        onMouseDown={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          autoFocus
          onBlur={() => inputRef.current?.focus()}
          onKeyDown={(e) => typingTest.handleKeyDown(e.nativeEvent)}
          className="pointer-events-none absolute opacity-0"
          aria-hidden="true"
        />

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
          {/* Timer + WPM */}
          <div className="flex items-center justify-center gap-6">
            <div
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 ${
                typingTest.timeLeft <= 5
                  ? "border-destructive/40 bg-destructive/10"
                  : "border-border bg-card"
              }`}
            >
              <Clock
                size={18}
                className={
                  typingTest.timeLeft <= 5 ? "text-destructive" : "text-muted-foreground"
                }
              />
              <span
                className={`text-3xl font-bold tabular-nums ${
                  typingTest.timeLeft <= 5 ? "text-destructive" : "text-foreground"
                }`}
              >
                {typingTest.timeLeft}
              </span>
              <span
                className={`text-xs ${
                  typingTest.timeLeft <= 5 ? "text-destructive/70" : "text-muted-foreground"
                }`}
              >
                sec
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
              <Activity size={18} className="text-primary" />
              <span className="text-3xl font-bold tabular-nums text-primary">
                {typingTest.liveWpm}
              </span>
              <span className="text-xs text-primary/70">wpm</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3">
              <Target size={18} className="text-emerald-300" />
              <span className="text-3xl font-bold tabular-nums text-emerald-300">
                {typingTest.liveAccuracy}
              </span>
              <span className="text-xs text-emerald-300/70">%</span>
            </div>
          </div>

          {/* Typing area */}
          <TypingDisplay
            words={words}
            currentWordIndex={typingTest.currentWordIndex}
            currentCharIndex={typingTest.currentCharIndex}
            getWordCharStates={typingTest.getWordCharStates}
            testState={typingTest.testState === "playing" ? "running" : "finished"}
          />

          {/* Live Leaderboard */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy size={16} />
                Live Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {leaderboard
                  .sort((a, b) => b.progress - a.progress || b.wpm - a.wpm)
                  .map((entry, index) => {
                    const player = room.players.find((p) => p.id === entry.playerId)
                    return (
                      <div
                        key={entry.playerId}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-all ${
                          entry.playerId === currentUserId
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={player?.image || undefined} />
                          <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                            {entry.playerName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="w-24 truncate text-sm font-medium">
                          {entry.playerName}
                        </span>
                        <div className="flex-1">
                          <Progress value={entry.progress} className="h-2" />
                        </div>
                        <span className="w-16 text-right text-sm font-semibold text-primary tabular-nums">
                          {entry.wpm} wpm
                        </span>
                        {entry.finished && (
                          <Check size={14} className="text-emerald-400" />
                        )}
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // --- FINISHED STATE ---
  if (room.status === "finished" && results.length > 0) {
    const isWinner = results.find((r) => r.placement === 1)?.playerId === currentUserId
    const myResult = results.find((r) => r.playerId === currentUserId)
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background text-foreground">
        <WinnerCelebration isWinner={isWinner} intense={isWinner || isNewRecord} />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-8 px-6 py-8">
          {/* Title */}
          <div className="flex flex-col items-center gap-2">
            <Trophy size={40} className="text-amber-400" />
            <h1 className="text-3xl font-bold tracking-tight">Race Results</h1>
            {matchId && (
              <p className="text-xs text-muted-foreground">Match #{matchId}</p>
            )}
            {myResult && (
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Best: {personalBest} wpm</span>
                {isNewRecord && (
                  <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    New Record
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Podium / Results Table */}
          <div className="w-full max-w-2xl">
            <div className="flex flex-col gap-3">
              {results
                .sort((a, b) => a.placement - b.placement)
                .map((result) => {
                  const placementIcon =
                    result.placement === 1 ? (
                      <Trophy size={20} className="text-amber-400" />
                    ) : result.placement === 2 ? (
                      <Medal size={20} className="text-gray-300" />
                    ) : result.placement === 3 ? (
                      <Medal size={20} className="text-amber-600" />
                    ) : null

                  const isMe = result.playerId === currentUserId

                  return (
                    <div
                      key={result.playerId}
                      className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                        result.placement === 1
                          ? "border-amber-400/30 bg-amber-400/5"
                          : isMe
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-card"
                      }`}
                    >
                      {/* Placement */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
                        {placementIcon || (
                          <span className="text-lg font-bold text-muted-foreground">
                            {result.placement}
                          </span>
                        )}
                      </div>

                      {/* Player info */}
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={result.playerImage || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {result.playerName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-1 flex-col">
                        <span className="font-semibold">
                          {result.playerName}
                          {isMe && (
                            <span className="ml-2 text-xs text-primary">(You)</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Raw: {result.rawWpm} wpm
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            <Zap size={14} className="text-primary" />
                            <span className="text-lg font-bold text-primary tabular-nums">
                              {result.wpm}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">wpm</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            <Target size={14} className="text-emerald-400" />
                            <span className="text-lg font-bold text-emerald-400 tabular-nums">
                              {result.accuracy}%
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">accuracy</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {isHost && (
              <Button onClick={resetToLobby} size="lg">
                <Users size={18} />
                Return to Lobby
              </Button>
            )}
            <Button onClick={handleLeave} variant="outline" size="lg">
              <LogOut size={18} />
              Leave Room
            </Button>
          </div>

          {!isHost && (
            <p className="text-sm text-muted-foreground">
              Waiting for the host to return everyone to the lobby...
            </p>
          )}
        </main>
      </div>
    )
  }

  // Fallback (countdown without counter, or transitional state)
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={32} />
      <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
    </div>
  )
}
