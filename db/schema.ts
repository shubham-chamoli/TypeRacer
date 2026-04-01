import { sqliteTable, text, integer, real, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

// Helper to generate cuid-like IDs
function cuid() {
  return sql`(lower(hex(randomblob(12))))`
}

// === NextAuth Required Tables ===

export const users = sqliteTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
})

export const accounts = sqliteTable("account", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [
  uniqueIndex("account_provider_providerAccountId_idx").on(table.provider, table.providerAccountId),
])

export const sessions = sqliteTable("session", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
})

export const verificationTokens = sqliteTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("verificationToken_identifier_token_idx").on(table.identifier, table.token),
])

// === App Tables ===

export const userStats = sqliteTable("userStats", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  bestWpm: integer("bestWpm").notNull().default(0),
  averageWpm: real("averageWpm").notNull().default(0),
  totalGames: integer("totalGames").notNull().default(0),
  totalWins: integer("totalWins").notNull().default(0),
})

export const matches = sqliteTable("match", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  roomCode: text("roomCode").notNull(),
  difficulty: text("difficulty").notNull(),
  timeLimit: integer("timeLimit").notNull(),
  wordsSeed: text("wordsSeed").notNull(),
  playerCount: integer("playerCount").notNull(),
  startedAt: integer("startedAt", { mode: "timestamp" }).notNull(),
  endedAt: integer("endedAt", { mode: "timestamp" }),
})

export const matchResults = sqliteTable("matchResult", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matchId: text("matchId").notNull().references(() => matches.id, { onDelete: "cascade" }),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  wpm: integer("wpm").notNull(),
  rawWpm: integer("rawWpm").notNull(),
  accuracy: real("accuracy").notNull(),
  placement: integer("placement").notNull(),
}, (table) => [
  uniqueIndex("matchResult_matchId_userId_idx").on(table.matchId, table.userId),
])

export const friendRequests = sqliteTable("friendRequest", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  senderId: text("senderId").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: text("receiverId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("friendRequest_senderId_receiverId_idx").on(table.senderId, table.receiverId),
])

export const friendships = sqliteTable("friendship", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userAId: text("userAId").notNull().references(() => users.id, { onDelete: "cascade" }),
  userBId: text("userBId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("friendship_userAId_userBId_idx").on(table.userAId, table.userBId),
])
