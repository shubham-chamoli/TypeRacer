import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const token =
    cookieStore.get("authjs.session-token")?.value ??
    cookieStore.get("__Secure-authjs.session-token")?.value ??
    cookieStore.get("next-auth.session-token")?.value ??
    cookieStore.get("__Secure-next-auth.session-token")?.value ??
    null
  return Response.json({ token })
}
