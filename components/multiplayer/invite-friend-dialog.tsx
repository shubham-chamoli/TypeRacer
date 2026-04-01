"use client"

import { useState, useEffect } from "react"
import { getFriends } from "@/actions/friends"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlus, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Socket } from "socket.io-client"
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/socket"

interface InviteFriendDialogProps {
  roomCode: string
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null
}

interface FriendInfo {
  id: string
  name: string | null
  email: string
  image: string | null
}

export function InviteFriendDialog({ roomCode, socket }: InviteFriendDialogProps) {
  const [friends, setFriends] = useState<FriendInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setLoading(true)
      getFriends().then((f) => {
        setFriends(f)
        setLoading(false)
      })
    }
  }, [open])

  function handleInvite(friendId: string) {
    if (!socket) return
    socket.emit("friend:invite-to-room", { friendId, roomCode })
    setInvitedIds((prev) => new Set(prev).add(friendId))
    toast.success("Invitation sent!")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus size={16} />
          Invite Friend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a Friend</DialogTitle>
          <DialogDescription>
            Send a room invite to one of your friends
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : friends.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No friends to invite. Add some friends first!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={friend.image || undefined} />
                  <AvatarFallback className="bg-primary/20 text-xs text-primary">
                    {friend.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium">
                  {friend.name || "Unknown"}
                </span>
                <Button
                  size="sm"
                  variant={invitedIds.has(friend.id) ? "secondary" : "default"}
                  disabled={invitedIds.has(friend.id)}
                  onClick={() => handleInvite(friend.id)}
                >
                  {invitedIds.has(friend.id) ? (
                    "Invited"
                  ) : (
                    <>
                      <Send size={12} />
                      Invite
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
