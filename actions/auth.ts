"use server"

import { db } from "@/lib/db"
import { users, userStats } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { registerSchema } from "@/lib/validators"

export async function registerUser(data: { name: string; email: string; password: string }) {
  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors[0].message }
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })

  if (existing) {
    return { success: false as const, error: "An account with this email already exists" }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const [user] = await db.insert(users).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
  }).returning()

  await db.insert(userStats).values({
    userId: user.id,
  })

  return { success: true as const }
}
