"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { getUserStats, getMatchHistory, getUserProfile } from "@/actions/stats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Zap, Target, Trophy, Gamepad2, Loader2, ChevronLeft, ChevronRight } from "lucide-react"

interface Stats {
  bestWpm: number
  averageWpm: number
  totalGames: number
  totalWins: number
}

interface MatchHistoryItem {
  id: string
  matchId: string
  wpm: number
  rawWpm: number
  accuracy: number
  placement: number
  difficulty: string
  timeLimit: number
  playerCount: number
  startedAt: string
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<MatchHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ name: string | null; email: string; image: string | null; createdAt: string } | null>(null)

  useEffect(() => {
    if (!session) return
    async function load() {
      setLoading(true)
      try {
        const [s, h, p] = await Promise.all([
          getUserStats(),
          getMatchHistory(page),
          getUserProfile(),
        ])
        setStats(s)
        setHistory(h.results)
        setTotalPages(h.pages)
        if (p) {
          setProfile({
            name: p.name,
            email: p.email ?? "",
            image: p.image,
            createdAt: p.createdAt.toISOString(),
          })
        }
      } catch {
        // Error loading
      }
      setLoading(false)
    }
    load()
  }, [session, page])

  if (!session) return null

  if (loading && !stats) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    )
  }

  const user = session.user
  const winRate = stats && stats.totalGames > 0
    ? Math.round((stats.totalWins / stats.totalGames) * 100)
    : 0

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        {/* Profile header */}
        <div className="mb-8 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.image || undefined} />
            <AvatarFallback className="bg-primary/20 text-xl text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{user?.name || "Player"}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {profile?.createdAt && (
              <p className="text-xs text-muted-foreground">
                Member since {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap size={14} />
                  <span className="text-xs font-medium uppercase tracking-wider">Best WPM</span>
                </div>
                <span className="text-3xl font-bold tabular-nums text-primary">{stats.bestWpm}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target size={14} />
                  <span className="text-xs font-medium uppercase tracking-wider">Avg WPM</span>
                </div>
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {Math.round(stats.averageWpm)}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Gamepad2 size={14} />
                  <span className="text-xs font-medium uppercase tracking-wider">Games</span>
                </div>
                <span className="text-3xl font-bold tabular-nums text-foreground">{stats.totalGames}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Trophy size={14} />
                  <span className="text-xs font-medium uppercase tracking-wider">Win Rate</span>
                </div>
                <span className="text-3xl font-bold tabular-nums text-amber-400">{winRate}%</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Match History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Match History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No matches played yet. Join a multiplayer room to get started!
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {history.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center gap-4 rounded-lg border border-border p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
                        {match.placement === 1 ? (
                          <Trophy size={16} className="text-amber-400" />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">
                            #{match.placement}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary tabular-nums">{match.wpm} wpm</span>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {match.difficulty}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {match.timeLimit}s
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {match.playerCount} players &middot;{" "}
                          {new Date(match.startedAt).toLocaleDateString()} &middot;{" "}
                          Accuracy: {match.accuracy}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
