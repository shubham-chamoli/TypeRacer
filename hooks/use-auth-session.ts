"use client"

import { useCallback, useEffect, useState } from "react"

type SessionUser = {
  id: string
  name: string | null
  email: string
  image: string | null
}

type Session = {
  user: SessionUser
}

export function useAuthSession() {
  const [data, setData] = useState<Session | null>(null)
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading")

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" })
      if (!res.ok) {
        setData(null)
        setStatus("unauthenticated")
        return
      }

      const payload = await res.json()
      if (payload?.session?.user?.id) {
        setData(payload.session)
        setStatus("authenticated")
      } else {
        setData(null)
        setStatus("unauthenticated")
      }
    } catch {
      setData(null)
      setStatus("unauthenticated")
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, status, refresh }
}
