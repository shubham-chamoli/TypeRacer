import { cookies } from "next/headers"
import { getSessionCookieName } from "@/lib/auth"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(getSessionCookieName())?.value ?? null
  return Response.json({ token })
}
