"use server"

import { db } from "@/lib/db"
import { users, friendRequests, friendships } from "@/db/schema"
import { eq, and, or, ne, like, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"

async function getSession() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user
}

export async function searchUsers(query: string) {
  const user = await getSession()
  if (!query || query.length < 2) return []

  const results = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    image: users.image,
  }).from(users).where(
    and(
      ne(users.id, user.id!),
      or(
        like(users.name, `%${query}%`),
        like(users.email, `%${query}%`)
      )
    )
  ).limit(10)

  return results
}

export async function sendFriendRequest(receiverId: string) {
  const user = await getSession()

  if (user.id === receiverId) {
    return { success: false as const, error: "Cannot send request to yourself" }
  }

  const existing = await db.query.friendRequests.findFirst({
    where: or(
      and(eq(friendRequests.senderId, user.id!), eq(friendRequests.receiverId, receiverId)),
      and(eq(friendRequests.senderId, receiverId), eq(friendRequests.receiverId, user.id!))
    ),
  })

  if (existing) {
    return { success: false as const, error: "Friend request already exists" }
  }

  const friendship = await db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.userAId, user.id!), eq(friendships.userBId, receiverId)),
      and(eq(friendships.userAId, receiverId), eq(friendships.userBId, user.id!))
    ),
  })

  if (friendship) {
    return { success: false as const, error: "Already friends" }
  }

  await db.insert(friendRequests).values({
    senderId: user.id!,
    receiverId,
  })

  return { success: true as const }
}

export async function respondToFriendRequest(requestId: string, accept: boolean) {
  const user = await getSession()

  const request = await db.query.friendRequests.findFirst({
    where: eq(friendRequests.id, requestId),
  })

  if (!request || request.receiverId !== user.id) {
    return { success: false as const, error: "Request not found" }
  }

  if (request.status !== "pending") {
    return { success: false as const, error: "Request already handled" }
  }

  if (accept) {
    const [userAId, userBId] = [request.senderId, request.receiverId].sort()
    await db.update(friendRequests)
      .set({ status: "accepted" })
      .where(eq(friendRequests.id, requestId))
    await db.insert(friendships).values({ userAId, userBId })
  } else {
    await db.update(friendRequests)
      .set({ status: "rejected" })
      .where(eq(friendRequests.id, requestId))
  }

  return { success: true as const }
}

export async function removeFriend(friendId: string) {
  const user = await getSession()

  await db.delete(friendships).where(
    or(
      and(eq(friendships.userAId, user.id!), eq(friendships.userBId, friendId)),
      and(eq(friendships.userAId, friendId), eq(friendships.userBId, user.id!))
    )
  )

  await db.delete(friendRequests).where(
    or(
      and(eq(friendRequests.senderId, user.id!), eq(friendRequests.receiverId, friendId)),
      and(eq(friendRequests.senderId, friendId), eq(friendRequests.receiverId, user.id!))
    )
  )

  return { success: true as const }
}

export async function getFriends() {
  const user = await getSession()

  const friendshipsA = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    image: users.image,
  }).from(friendships)
    .innerJoin(users, eq(friendships.userBId, users.id))
    .where(eq(friendships.userAId, user.id!))

  const friendshipsB = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    image: users.image,
  }).from(friendships)
    .innerJoin(users, eq(friendships.userAId, users.id))
    .where(eq(friendships.userBId, user.id!))

  return [...friendshipsA, ...friendshipsB]
}

export async function getPendingRequests() {
  const user = await getSession()

  const requests = await db.select({
    id: friendRequests.id,
    senderId: friendRequests.senderId,
    receiverId: friendRequests.receiverId,
    status: friendRequests.status,
    createdAt: friendRequests.createdAt,
    sender: {
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    },
  }).from(friendRequests)
    .innerJoin(users, eq(friendRequests.senderId, users.id))
    .where(
      and(
        eq(friendRequests.receiverId, user.id!),
        eq(friendRequests.status, "pending")
      )
    )
    .orderBy(desc(friendRequests.createdAt))

  return requests
}
