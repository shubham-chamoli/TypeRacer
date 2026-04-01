"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSocket } from "@/hooks/use-socket"
import { useRoom } from "@/hooks/use-room"
import { useAuthSession } from "@/hooks/use-auth-session"
import type { RoomConfig } from "@/types/socket"
import type { Difficulty } from "@/lib/words"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Gamepad2, Plus, LogIn, Zap, Gauge, Timer, Loader2, WifiOff, UserX } from "lucide-react"

type TimerOption = 15 | 30 | 60

export default function MultiplayerLobbyPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useAuthSession()
  const { socket, isConnected, isConnecting, error: socketError } = useSocket()
  const { createRoom, joinRoom, error: roomError, isLoading } = useRoom(socket, isConnected)

  const [difficulty, setDifficulty] = useState<Difficulty>("normal")
  const [timerOption, setTimerOption] = useState<TimerOption>(30)
  const [wordCount, setWordCount] = useState<50 | 100 | 200>(100)
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)

  const timers: TimerOption[] = [15, 30, 60]
  const difficulties: { value: Difficulty; label: string; icon: React.ReactNode }[] = [
    { value: "easy", label: "Easy", icon: <Zap size={14} /> },
    { value: "normal", label: "Medium", icon: <Gauge size={14} /> },
    { value: "hard", label: "Hard", icon: <Timer size={14} /> },
  ]

  async function handleCreateRoom() {
    const config: RoomConfig = {
      timeLimit: timerOption,
      difficulty,
      wordCount,
    }
    const code = await createRoom(config)
    if (code) {
      router.push(`/multiplayer/room/${code}`)
    }
  }

  async function handleJoinRoom() {
    if (joinCode.length !== 4) {
      setJoinError("Please enter a 4-character room code")
      return
    }
    setJoinError(null)
    const success = await joinRoom(joinCode.toUpperCase())
    if (success) {
      router.push(`/multiplayer/room/${joinCode.toUpperCase()}`)
    }
  }

  // Not authenticated
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <UserX className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sign In Required</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            You need to be signed in to play multiplayer. Create an account or sign in to race against friends.
          </p>
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Loading session
  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    )
  }

  // Socket connecting / error state
  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {isConnecting ? (
            <>
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-sm text-muted-foreground">Connecting to game server...</p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                <WifiOff className="text-destructive" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Connection Failed</h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                {socketError || "Unable to connect to the game server. Please try again later."}
              </p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Gamepad2 className="text-primary" size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Multiplayer</h1>
          <p className="text-sm text-muted-foreground">
            Create a room or join an existing one to race against friends
          </p>
        </div>

        {/* Error display */}
        {(roomError || joinError) && (
          <div className="w-full max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {roomError || joinError}
          </div>
        )}

        {/* Lobby cards */}
        <div className="grid w-full max-w-2xl gap-6 md:grid-cols-2">
            {/* Create Room Card */}
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus size={18} />
                Create Room
              </CardTitle>
              <CardDescription>
                Set up a new room and invite friends to race
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Difficulty selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Difficulty
                </label>
                <div className="flex items-center rounded-xl border border-border bg-background p-1">
                  {difficulties.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        difficulty === d.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } cursor-pointer`}
                    >
                      {d.icon}
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Time Limit
                </label>
                <div className="flex items-center rounded-xl border border-border bg-background p-1">
                  {timers.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimerOption(t)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        timerOption === t
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } cursor-pointer`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Create button */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Word Count
                </label>
                <div className="flex items-center rounded-xl border border-border bg-background p-1">
                  {([50, 100, 200] as const).map((count) => (
                    <button
                      key={count}
                      onClick={() => setWordCount(count)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        wordCount === count
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } cursor-pointer`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create button */}
              <Button
                onClick={handleCreateRoom}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Plus size={18} />
                )}
                {isLoading ? "Creating..." : "Create Room"}
              </Button>
            </CardContent>
            </Card>

            {/* Join Room Card */}
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn size={18} />
                Join Room
              </CardTitle>
              <CardDescription>
                Enter a room code to join an existing race
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* OTP Code input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Room Code
                </label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={4}
                    value={joinCode}
                    onChange={(value) => {
                      setJoinCode(value.toUpperCase())
                      setJoinError(null)
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="h-12 w-12 text-lg font-bold uppercase" />
                      <InputOTPSlot index={1} className="h-12 w-12 text-lg font-bold uppercase" />
                      <InputOTPSlot index={2} className="h-12 w-12 text-lg font-bold uppercase" />
                      <InputOTPSlot index={3} className="h-12 w-12 text-lg font-bold uppercase" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              {/* Spacer to align with create card */}
              <div className="flex-1" />

              {/* Join button */}
              <Button
                onClick={handleJoinRoom}
                disabled={isLoading || joinCode.length !== 4}
                className="w-full"
                size="lg"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <LogIn size={18} />
                )}
                {isLoading ? "Joining..." : "Join Room"}
              </Button>
            </CardContent>
            </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-5xl px-6 pb-6">
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>TypeRacer</span>
          <span>UI by Shubham Chamoli</span>
        </div>
      </footer>
    </div>
  )
}
