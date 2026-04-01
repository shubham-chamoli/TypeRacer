import { jwtVerify } from "jose"

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("Missing AUTH_SECRET (or NEXTAUTH_SECRET) environment variable")
  }
  return new TextEncoder().encode(secret)
}

export async function validateSocketToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())

    const userId = (payload.sub || (payload.id as string | undefined)) ?? null
    if (!userId) return null

    return {
      userId,
      userName: typeof payload.name === "string" ? payload.name : "Anonymous",
      userImage: typeof payload.image === "string" ? payload.image : null,
    }
  } catch (error) {
    console.error("[Auth] Token validation error:", error)
    return null
  }
}
