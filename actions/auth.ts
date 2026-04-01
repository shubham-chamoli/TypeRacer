"use server"

import { db } from "@/lib/db"
import { users, userStats } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { registerSchema } from "@/lib/validators"

export async function registerUser(data: { name: string; email: string; password: string }) {
  try {
    const parsed = registerSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0].message }
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase()

    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })

    if (existing) {
      return { success: false as const, error: "An account with this email already exists" }
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12)

    const [user] = await db.insert(users).values({
      name: parsed.data.name,
      email: normalizedEmail,
      passwordHash,
    }).returning()

    // Do not fail registration if stats row creation has an issue.
    // The user can still sign in, and stats can be initialized later.
    try {
      await db.insert(userStats).values({
        userId: user.id,
      })
    } catch (error) {
      console.error("[registerUser] Failed to create userStats:", error)
    }

    return { success: true as const }
  } catch (error) {
    console.error("[registerUser] Registration failed:", error)
    return { success: false as const, error: "Unable to create account right now. Please try again." }
  }
}
