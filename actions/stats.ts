"use server"

import { db } from "@/lib/db"
import { users, userStats, matchResults, matches } from "@/db/schema"
import { eq, desc, count } from "drizzle-orm"
import { auth } from "@/lib/auth"

async function getSession() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user
}

export async function getUserStats() {
  const user = await getSession()

  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, user.id!),
  })

  return stats ?? { bestWpm: 0, averageWpm: 0, totalGames: 0, totalWins: 0 }
}

export async function getMatchHistory(page: number = 1, limit: number = 20) {
  const user = await getSession()

  const results = await db.select({
    id: matchResults.id,
    matchId: matchResults.matchId,
    wpm: matchResults.wpm,
    rawWpm: matchResults.rawWpm,
    accuracy: matchResults.accuracy,
    placement: matchResults.placement,
    difficulty: matches.difficulty,
    timeLimit: matches.timeLimit,
    playerCount: matches.playerCount,
    startedAt: matches.startedAt,
  }).from(matchResults)
    .innerJoin(matches, eq(matchResults.matchId, matches.id))
    .where(eq(matchResults.userId, user.id!))
    .orderBy(desc(matches.startedAt))
    .limit(limit)
    .offset((page - 1) * limit)

  const [totalResult] = await db.select({ total: count() })
    .from(matchResults)
    .where(eq(matchResults.userId, user.id!))

  const total = totalResult?.total ?? 0

  return {
    results: results.map((r) => ({
      id: r.id,
      matchId: r.matchId,
      wpm: r.wpm,
      rawWpm: r.rawWpm,
      accuracy: r.accuracy,
      placement: r.placement,
      difficulty: r.difficulty,
      timeLimit: r.timeLimit,
      playerCount: r.playerCount,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : new Date(r.startedAt as number).toISOString(),
    })),
    total,
    pages: Math.ceil(total / limit),
  }
}

export async function getUserProfile() {
  const user = await getSession()

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id!),
    columns: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
    },
  })

  if (!profile) return null

  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, user.id!),
  })

  return { ...profile, stats: stats ?? null }
}
