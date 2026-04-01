"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  getFriends,
  getPendingRequests,
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest,
} from "@/actions/friends"
import type { ClientToServerEvents, DirectMessage, ServerToClientEvents } from "@/types/socket"
import type { Socket } from "socket.io-client"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  Search,
  Inbox,
  Check,
  X,
  Loader2,
  Wifi,
  WifiOff,
  LogIn,
  UserPlus,
  MessageCircle,
  Send,
} from "lucide-react"
import { toast } from "sonner"

interface FriendInfo {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: string
  createdAt: Date
  sender: FriendInfo
}

interface PresenceEntry {
  friendId: string
  online: boolean
  hostRoomCode: string | null
}

interface FriendsPopdownProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null
  isConnected: boolean
}

export function FriendsPopdown({ socket, isConnected }: FriendsPopdownProps) {
  const router = useRouter()
  const { data: session } = useSession()

  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "find">("friends")
  const [friends, setFriends] = useState<FriendInfo[]>([])
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceEntry>>({})
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<FriendInfo[]>([])
  const [activeChatFriendId, setActiveChatFriendId] = useState<string | null>(null)
  const [messagesByFriend, setMessagesByFriend] = useState<Record<string, DirectMessage[]>>({})
  const [unreadByFriend, setUnreadByFriend] = useState<Record<string, number>>({})
  const [chatInput, setChatInput] = useState("")

  const currentUserId = session?.user?.id

  const fetchPresence = useCallback((friendIds: string[]) => {
    if (!socket || !isConnected || friendIds.length === 0) {
      setPresenceMap({})
      return
    }

    socket.emit("friends:get-presence", { friendIds }, (response) => {
      const next: Record<string, PresenceEntry> = {}
      response.entries.forEach((entry) => {
        next[entry.friendId] = entry
      })
      setPresenceMap(next)
    })
  }, [socket, isConnected])

  const loadFriends = useCallback(async () => {
    setLoadingFriends(true)
    try {
      const data = await getFriends()
      setFriends(data)
      fetchPresence(data.map((friend) => friend.id))
    } catch {
      toast.error("Failed to load friends")
    }
    setLoadingFriends(false)
  }, [fetchPresence])

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const data = await getPendingRequests()
      setRequests(data)
    } catch {
      toast.error("Failed to load requests")
    }
    setLoadingRequests(false)
  }, [])

  useEffect(() => {
    if (!open) return
    loadFriends()
    loadRequests()
  }, [open, loadFriends, loadRequests])

  useEffect(() => {
    if (!open) {
      setActiveChatFriendId(null)
      setChatInput("")
      setActiveTab("friends")
    }
  }, [open])

  useEffect(() => {
    if (activeTab !== "friends") {
      setActiveChatFriendId(null)
      setChatInput("")
    }
  }, [activeTab])

  useEffect(() => {
    if (!socket || !isConnected) return

    function handleDirectMessage(message: DirectMessage) {
      const friendId = message.fromUserId === currentUserId ? message.toUserId : message.fromUserId
      setMessagesByFriend((prev) => ({
        ...prev,
        [friendId]: [...(prev[friendId] || []), message],
      }))

      const isIncoming = message.fromUserId !== currentUserId
      const isCurrentlyOpenChat = open && activeTab === "friends" && activeChatFriendId === friendId
      if (isIncoming && !isCurrentlyOpenChat) {
        setUnreadByFriend((prev) => ({
          ...prev,
          [friendId]: (prev[friendId] || 0) + 1,
        }))
      }
    }

    socket.on("dm:message", handleDirectMessage)
    return () => {
      socket.off("dm:message", handleDirectMessage)
    }
  }, [socket, isConnected, currentUserId, open, activeTab, activeChatFriendId])

  useEffect(() => {
    if (!open || friends.length === 0 || !isConnected) return

    const interval = window.setInterval(() => {
      fetchPresence(friends.map((friend) => friend.id))
    }, 10000)

    return () => window.clearInterval(interval)
  }, [open, friends, fetchPresence, isConnected])

  const onlineFriends = useMemo(() => {
    return friends.filter((friend) => presenceMap[friend.id]?.online)
  }, [friends, presenceMap])

  const offlineFriends = useMemo(() => {
    return friends.filter((friend) => !presenceMap[friend.id]?.online)
  }, [friends, presenceMap])

  const handleRespond = useCallback(async (requestId: string, accept: boolean) => {
    const result = await respondToFriendRequest(requestId, accept)
    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(accept ? "Friend request accepted" : "Request declined")
    setRequests((prev) => prev.filter((request) => request.id !== requestId))
    if (accept) {
      loadFriends()
    }
  }, [loadFriends])

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) return
    setSearching(true)
    try {
      const data = await searchUsers(query.trim())
      setResults(data)
    } catch {
      toast.error("Search failed")
    }
    setSearching(false)
  }, [query])

  const handleSendRequest = useCallback(async (userId: string) => {
    const result = await sendFriendRequest(userId)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success("Friend request sent")
    setResults((prev) => prev.filter((user) => user.id !== userId))
  }, [])

  const openChatForFriend = useCallback((friendId: string) => {
    setActiveChatFriendId(friendId)
    setChatInput("")
    setUnreadByFriend((prev) => {
      if (!prev[friendId]) return prev
      const next = { ...prev }
      delete next[friendId]
      return next
    })
  }, [])

  useEffect(() => {
    if (!activeChatFriendId || !socket || !isConnected) return
    socket.emit("dm:get-history", { friendId: activeChatFriendId }, (response) => {
      setMessagesByFriend((prev) => ({ ...prev, [activeChatFriendId]: response.messages }))
    })
  }, [activeChatFriendId, socket, isConnected])

  const handleSendDirectMessage = useCallback(() => {
    if (!activeChatFriendId || !socket || !isConnected) return
    const message = chatInput.trim()
    if (!message) return

    socket.emit("dm:send", { toUserId: activeChatFriendId, message })
    setChatInput("")
  }, [activeChatFriendId, socket, isConnected, chatInput])

  const activeChatFriend = useMemo(
    () => friends.find((friend) => friend.id === activeChatFriendId) ?? null,
    [friends, activeChatFriendId]
  )

  const activeMessages = activeChatFriendId ? messagesByFriend[activeChatFriendId] || [] : []
  const isExpandedFriendsView = activeTab === "friends" && !!activeChatFriend
  const totalUnreadMessages = Object.values(unreadByFriend).reduce((sum, count) => sum + count, 0)
  const totalNotifications = totalUnreadMessages + requests.length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative flex items-center gap-1.5 px-3">
          <Users size={15} />
          Friends
          {totalNotifications > 0 && (
            <Badge variant="destructive" className="ml-1 px-1.5 text-[10px]">
              +{totalNotifications}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`${isExpandedFriendsView ? "w-[760px]" : "w-[360px]"} p-3`}
      >
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-1">
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "friends" ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "requests" ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
          >
            Requests
            {requests.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 text-[10px]">{requests.length}</Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("find")}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "find" ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
          >
            Find
          </button>
        </div>

        {activeTab === "friends" && (
          activeChatFriend ? (
            <div className="grid min-h-[420px] gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-md border border-border">
                <div className="border-b border-border px-2 py-2 text-xs font-medium text-muted-foreground">
                  Friends
                </div>
                <div className="max-h-[360px] space-y-1 overflow-y-auto p-2">
                  {loadingFriends ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="animate-spin text-muted-foreground" size={18} />
                    </div>
                  ) : friends.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">No friends yet.</p>
                  ) : (
                    [...onlineFriends, ...offlineFriends].map((friend) => {
                      const roomCode = presenceMap[friend.id]?.hostRoomCode
                      const online = !!presenceMap[friend.id]?.online
                      return (
                        <button
                          key={friend.id}
                          onClick={() => openChatForFriend(friend.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                            activeChatFriendId === friend.id
                              ? "bg-primary/10"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={friend.image || undefined} />
                            <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                              {friend.name?.charAt(0)?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{friend.name || "Unknown"}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {online ? "Online" : "Offline"}
                            </p>
                          </div>
                          {unreadByFriend[friend.id] ? (
                            <span className="mr-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                          ) : null}
                          {roomCode ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/multiplayer/room/${roomCode}`)
                              }}
                            >
                              <LogIn size={10} />
                              Join
                            </Button>
                          ) : online ? (
                            <Wifi size={11} className="text-emerald-500" />
                          ) : (
                            <WifiOff size={11} className="text-muted-foreground" />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex h-full min-h-[360px] flex-col rounded-md border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-xs font-medium">{activeChatFriend.name || "Unknown"}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setActiveChatFriendId(null)}
                  >
                    <X size={12} />
                  </Button>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-muted/20 p-3">
                  {activeMessages.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground">No messages yet.</p>
                  ) : (
                    activeMessages.map((message) => {
                      const isMine = message.fromUserId === currentUserId
                      return (
                        <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-md px-2 py-1 text-xs ${
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

                <div className="mt-auto flex gap-2 border-t border-border p-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message"
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSendDirectMessage()
                      }
                    }}
                  />
                  <Button size="sm" className="h-8" onClick={handleSendDirectMessage}>
                    <Send size={12} />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <div className="max-h-[140px] space-y-1 overflow-y-auto p-2">
                {loadingFriends ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin text-muted-foreground" size={18} />
                  </div>
                ) : friends.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">No friends yet.</p>
                ) : (
                  [...onlineFriends, ...offlineFriends].map((friend) => {
                    const online = !!presenceMap[friend.id]?.online
                    const roomCode = presenceMap[friend.id]?.hostRoomCode
                    return (
                      <button
                        key={friend.id}
                        onClick={() => openChatForFriend(friend.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={friend.image || undefined} />
                          <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                            {friend.name?.charAt(0)?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{friend.name || "Unknown"}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{online ? "Online" : "Offline"}</p>
                        </div>
                        {unreadByFriend[friend.id] ? (
                          <span className="mr-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        ) : null}
                        {roomCode ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/multiplayer/room/${roomCode}`)
                            }}
                          >
                            <LogIn size={10} />
                            Join
                          </Button>
                        ) : (
                          <MessageCircle size={12} className="text-muted-foreground" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )
        )}

        {activeTab === "requests" && (
          <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
            {loadingRequests ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-muted-foreground" size={18} />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={request.sender.image || undefined} />
                    <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                      {request.sender.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{request.sender.name || "Unknown"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{request.sender.email}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 px-2" onClick={() => handleRespond(request.id, true)}>
                      <Check size={12} />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleRespond(request.id, false)}>
                      <X size={12} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "find" && (
          <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSearch()
              }}
              className="flex gap-2"
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                className="h-8"
              />
              <Button type="submit" size="sm" className="h-8" disabled={searching || query.trim().length < 2}>
                {searching ? <Loader2 className="animate-spin" size={12} /> : <Search size={12} />}
              </Button>
            </form>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Search users to add them as friends.</p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {results.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                        {user.name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user.name || "Unknown"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                    </div>
                    <Button size="sm" className="h-7 px-2" onClick={() => handleSendRequest(user.id)}>
                      <UserPlus size={12} />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
