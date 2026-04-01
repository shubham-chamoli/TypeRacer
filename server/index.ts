import { createServer } from "http"
import { Server } from "socket.io"
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types/socket"
import { validateSocketToken } from "./auth"
import { registerHandlers } from "./socket-handlers"

const httpServer = createServer()
const corsOrigins = (process.env.SOCKET_CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
})

// Auth middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error("Authentication required"))
  }

  const user = await validateSocketToken(token)
  if (!user) {
    return next(new Error("Invalid or expired session"))
  }

  socket.data.userId = user.userId
  socket.data.userName = user.userName
  socket.data.userImage = user.userImage
  next()
})

io.on("connection", (socket) => {
  console.log(`[Socket] ${socket.data.userName} connected (${socket.id})`)
  registerHandlers(io, socket)
})

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10)

httpServer.listen(PORT, () => {
  console.log(`[Socket.IO] Server running on port ${PORT}`)
})
