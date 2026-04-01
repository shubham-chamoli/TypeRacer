import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"

const SESSION_COOKIE = "session-token"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("Missing AUTH_SECRET (or NEXTAUTH_SECRET) environment variable")
  }
  return secret
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret())
}

export interface SessionUser {
  id: string
  name: string | null
  email: string
  image: string | null
}

export interface Session {
  user: SessionUser
}

export function getSessionCookieName() {
  return SESSION_COOKIE
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
    image: user.image,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    const userId = typeof payload.sub === "string" ? payload.sub : ""
    const email = typeof payload.email === "string" ? payload.email : ""

    if (!userId || !email) {
      return null
    }

    return {
      id: userId,
      name: typeof payload.name === "string" ? payload.name : null,
      email,
      image: typeof payload.image === "string" ? payload.image : null,
    }
  } catch {
    return null
  }
}

export async function auth(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const user = await verifySessionToken(token)
  if (!user) return null

  return { user }
}
