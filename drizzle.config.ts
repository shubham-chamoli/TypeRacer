import "dotenv/config"
import { defineConfig } from "drizzle-kit"

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  throw new Error("Missing TURSO_DATABASE_URL (or DATABASE_URL) environment variable")
}

const drizzleUrl = authToken
  ? `${url}${url.includes("?") ? "&" : "?"}authToken=${encodeURIComponent(authToken)}`
  : url

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: drizzleUrl,
  },
})
