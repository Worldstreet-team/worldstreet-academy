/**
 * Zero-credentials dev launcher.
 *
 *   pnpm dev:mock
 *
 * Boots a real mongod (mongodb-memory-server, persisted to .local-db so data
 * survives restarts), seeds it if empty, then starts `next dev` with MOCK_AUTH=1
 * so next.config.ts aliases @clerk/nextjs to the stub in mocks/clerk.
 *
 * Everything else (R2, Ably, RealtimeKit, OpenAI, Resend, wallet) stays
 * unconfigured — those features degrade at call time, they don't block boot.
 */

import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { MongoMemoryServer } from "mongodb-memory-server"

const DB_NAME = "worldstreet-academy"
const DB_PORT = Number(process.env.MOCK_DB_PORT ?? 27017)
const dbPath = path.resolve(".local-db")

mkdirSync(dbPath, { recursive: true })

console.log("[dev:mock] starting local MongoDB…")
console.log("[dev:mock] (first run downloads a mongod binary — this can take a minute)")

const mongod = await MongoMemoryServer.create({
  instance: {
    port: DB_PORT,
    dbName: DB_NAME,
    dbPath,
    storageEngine: "wiredTiger",
  },
})

const uri = `mongodb://127.0.0.1:${DB_PORT}/${DB_NAME}`
console.log(`[dev:mock] MongoDB ready at ${uri}`)

const childEnv = {
  ...process.env,
  MONGODB_URI: uri,
  MOCK_AUTH: "1",
  MOCK_PERSONA: process.env.MOCK_PERSONA ?? "student",
  NEXT_PUBLIC_MOCK_PERSONA: process.env.MOCK_PERSONA ?? "student",
}

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: childEnv,
      stdio: "inherit",
      shell: process.platform === "win32",
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} exited with code ${code}`))
    })
  })
}

let devProcess = null
let shuttingDown = false

async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (devProcess && devProcess.exitCode === null) devProcess.kill()
  await mongod.stop()
  console.log("\n[dev:mock] MongoDB stopped")
  process.exit(code)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

try {
  // seed.ts is idempotent — it skips anything that already exists.
  console.log("[dev:mock] seeding demo data…")
  await run("npx", ["tsx", "scripts/seed.ts"], "seed")

  console.log("[dev:mock] starting next dev (MOCK_AUTH=1)…")
  devProcess = spawn("npx", ["next", "dev"], {
    env: childEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  devProcess.on("exit", (code) => shutdown(code ?? 0))
} catch (err) {
  console.error("[dev:mock]", err)
  await shutdown(1)
}
