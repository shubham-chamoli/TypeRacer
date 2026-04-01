import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "@/db/schema"

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL

if (!url) {
	throw new Error("Missing TURSO_DATABASE_URL (or DATABASE_URL) environment variable")
}

const client = createClient({
	url,
	authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })
