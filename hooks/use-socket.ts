"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { getSocket, disconnectSocket } from "@/lib/socket"
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/socket"
import type { Socket } from "socket.io-client"

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface UseSocketReturn {
  socket: TypedSocket | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

export function useSocket(): UseSocketReturn {
  const { data: session, status } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<TypedSocket | null>(null)
  const mountedRef = useRef(true)

  const handleConnect = useCallback(() => {
    if (!mountedRef.current) return
    setIsConnected(true)
    setIsConnecting(false)
    setError(null)
  }, [])

  const handleDisconnect = useCallback(() => {
    if (!mountedRef.current) return
    setIsConnected(false)
  }, [])

  const handleConnectError = useCallback((err: Error) => {
    if (!mountedRef.current) return
    setIsConnecting(false)
    setError(err.message || "Connection failed")
  }, [])

  const handleError = useCallback((data: { message: string }) => {
    if (!mountedRef.current) return
    setError(data.message)
  }, [])

  useEffect(() => {
    mountedRef.current = true

    if (status !== "authenticated" || !session?.user) {
      setIsConnected(false)
      setIsConnecting(false)
      return
    }

    let cancelled = false

    async function connect() {
      try {
        setIsConnecting(true)
        setError(null)

        const res = await fetch("/api/auth/session-token")
        const { token } = await res.json()

        if (cancelled || !token) {
          setIsConnecting(false)
          if (!token) setError("No session token available")
          return
        }

        const socket = getSocket(token)
        socketRef.current = socket

        socket.on("connect", handleConnect)
        socket.on("disconnect", handleDisconnect)
        socket.on("connect_error", handleConnectError)
        socket.on("error", handleError)

        if (!socket.connected) {
          socket.connect()
        } else {
          setIsConnected(true)
          setIsConnecting(false)
        }
      } catch {
        if (!cancelled) {
          setIsConnecting(false)
          setError("Failed to initialize socket connection")
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      mountedRef.current = false

      const socket = socketRef.current
      if (socket) {
        socket.off("connect", handleConnect)
        socket.off("disconnect", handleDisconnect)
        socket.off("connect_error", handleConnectError)
        socket.off("error", handleError)
      }
    }
  }, [status, session?.user, handleConnect, handleDisconnect, handleConnectError, handleError])

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
  }
}
