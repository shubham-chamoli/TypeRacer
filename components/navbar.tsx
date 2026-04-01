"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Gauge, Menu, User, LogOut, Gamepad2, Keyboard, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FriendsPopdown } from "@/components/friends-popdown"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useSocket } from "@/hooks/use-socket"
import { useAuthSession } from "@/hooks/use-auth-session"
import { toast } from "sonner"

const navLinks = [
  { href: "/", label: "Solo", icon: Keyboard },
  { href: "/multiplayer", label: "Multiplayer", icon: Gamepad2 },
]

export function Navbar() {
  const { data: session, refresh } = useAuthSession()
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { socket, isConnected } = useSocket()

  const user = session?.user

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    await refresh()
    router.push("/")
    router.refresh()
  }

  // Listen for room invitations
  useEffect(() => {
    if (!socket || !isConnected) return

    function handleRoomInvite(data: { fromUserId: string; fromUserName: string; roomCode: string }) {
      toast(`${data.fromUserName} invited you to a room!`, {
        description: `Room code: ${data.roomCode}`,
        action: {
          label: "Join",
          onClick: () => router.push(`/multiplayer/room/${data.roomCode}`),
        },
        duration: 15000,
      })
    }

    socket.on("notification:room-invite", handleRoomInvite)
    return () => {
      socket.off("notification:room-invite", handleRoomInvite)
    }
  }, [socket, isConnected, router])

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Gauge className="text-primary-foreground" size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            TypeRacer
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Desktop auth */}
          <div className="hidden md:flex">
            {user ? (
              <div className="flex items-center gap-1">
                <FriendsPopdown socket={socket} isConnected={isConnected} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 px-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback className="bg-primary/20 text-xs text-primary">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[100px] truncate text-sm">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2">
                        <Trophy size={14} />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            )}
          </div>

          {/* Mobile hamburger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Gauge size={18} className="text-primary" />
                  TypeRacer
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  const isActive = pathname === link.href
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setSheetOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={16} />
                      {link.label}
                    </Link>
                  )
                })}
                {user && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <Link
                      href="/profile"
                      onClick={() => setSheetOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Trophy size={16} />
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        setSheetOpen(false)
                        handleSignOut()
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </>
                )}
                {!user && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <Link
                      href="/auth/login"
                      onClick={() => setSheetOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-primary"
                    >
                      <User size={16} />
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
