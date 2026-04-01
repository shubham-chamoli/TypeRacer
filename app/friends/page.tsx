"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getFriends } from "@/actions/friends"
import { useSocket } from "@/hooks/use-socket"
import { useAuthSession } from "@/hooks/use-auth-session"
import type { DirectMessage } from "@/types/socket"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, Send, Loader2, Users } from "lucide-react"
import { toast } from "sonner"

interface UserInfo {
  id: string
  name: string | null
  email: string
  image: string | null
}

export default function FriendsPage() {
  const { data: session } = useAuthSession()
  const currentUserId = session?.user?.id
  const { socket, isConnected } = useSocket()

  const [friends, setFriends] = useState<UserInfo[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const [messagesByFriend, setMessagesByFriend] = useState<Record<string, DirectMessage[]>>({})
  const [chatInput, setChatInput] = useState("")
  const [loading, setLoading] = useState(true)

  const loadFriends = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFriends()
      setFriends(data)
      if (!selectedFriendId && data.length > 0) {
        setSelectedFriendId(data[0].id)
      }
    } catch {
      toast.error("Failed to load friends")
    }
    setLoading(false)
  }, [selectedFriendId])

  useEffect(() => {
    if (session) {
      loadFriends()
    }
  }, [session, loadFriends])

  useEffect(() => {
    if (!socket || !isConnected || !currentUserId) return

    function handleDirectMessage(message: DirectMessage) {
      const friendId = message.fromUserId === currentUserId ? message.toUserId : message.fromUserId
      setMessagesByFriend((prev) => ({
        ...prev,
        [friendId]: [...(prev[friendId] || []), message],
      }))
    }

    socket.on("dm:message", handleDirectMessage)
    return () => {
      socket.off("dm:message", handleDirectMessage)
    }
  }, [socket, isConnected, currentUserId])

  useEffect(() => {
    if (!selectedFriendId || !socket || !isConnected) return

    socket.emit("dm:get-history", { friendId: selectedFriendId }, (response) => {
      setMessagesByFriend((prev) => ({ ...prev, [selectedFriendId]: response.messages }))
    })
  }, [selectedFriendId, socket, isConnected])

  const handleSendMessage = useCallback(() => {
    if (!selectedFriendId || !socket || !isConnected) return
    const message = chatInput.trim()
    if (!message) return

    socket.emit("dm:send", { toUserId: selectedFriendId, message })
    setChatInput("")
  }, [selectedFriendId, socket, isConnected, chatInput])

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  )

  const messages = selectedFriendId ? messagesByFriend[selectedFriendId] || [] : []

  if (!session) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">Sign in to chat with friends.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden px-4 py-6 md:px-6">
        <div className="grid w-full overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[300px_minmax(0,1fr)]">
          <section className="border-r border-border">
            <div className="border-b border-border px-4 py-3">
              <h1 className="flex items-center gap-2 text-base font-semibold">
                <Users size={16} />
                Friends
              </h1>
            </div>
            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-muted-foreground" size={20} />
                </div>
              ) : friends.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">No friends yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {friends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => setSelectedFriendId(friend.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                        selectedFriendId === friend.id ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.image || undefined} />
                        <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                          {friend.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{friend.name || "Unknown"}</p>
                        <p className="truncate text-xs text-muted-foreground">{friend.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-[520px] flex-col">
            {selectedFriend ? (
              <>
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedFriend.image || undefined} />
                      <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                        {selectedFriend.name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{selectedFriend.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Direct chat</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-muted/15 p-4">
                  {messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">Start the conversation.</p>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.fromUserId === currentUserId
                      return (
                        <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                              isMine
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-background text-foreground"
                            }`}
                          >
                            {message.message}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="border-t border-border p-3">
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={`Message ${selectedFriend.name || "friend"}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                    />
                    <Button onClick={handleSendMessage}>
                      <Send size={14} />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <MessageCircle className="text-muted-foreground" size={28} />
                <p className="text-sm text-muted-foreground">Select a friend to start chatting.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
