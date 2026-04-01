import { decode } from "@auth/core/jwt"
import fs from "fs"
import path from "path"

function readEnvSecret() {
  const fromProcess = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (fromProcess) return fromProcess

  try {
    const envPath = path.join(process.cwd(), ".env")
    if (!fs.existsSync(envPath)) return ""
    const envRaw = fs.readFileSync(envPath, "utf8")
    const match = envRaw.match(/^(NEXTAUTH_SECRET|AUTH_SECRET)\s*=\s*"?([^"\r\n]+)"?/m)
    return match?.[2] ?? ""
  } catch {
    return ""
  }
}

const secret = readEnvSecret()

async function decodeSessionToken(token: string) {
  if (!secret) return null

  // Auth.js cookie salt differs by version and secure-cookie usage.
  const salts = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ]

  for (const salt of salts) {
    const payload = await decode({ token, secret, salt })
    if (payload) return payload
  }

  return null
}

export async function validateSocketToken(token: string) {
  try {
    const payload = await decodeSessionToken(token)
    if (!payload) return null

    const userId = (payload.sub || (payload.id as string | undefined)) ?? null
    if (!userId) return null

    return {
      userId,
      userName: typeof payload.name === "string" ? payload.name : "Anonymous",
      userImage: typeof payload.picture === "string" ? payload.picture : null,
    }
  } catch (error) {
    console.error("[Auth] Token validation error:", error)
    return null
  }
}
