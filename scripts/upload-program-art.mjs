/**
 * Upload program thumbnails to the PUBLIC R2 bucket and store their URLs on
 * `courses.thumbnailUrl` (Phase 9, Task 21).
 *
 *   MONGODB_URI=<uri> node scripts/upload-program-art.mjs <dir>             # dry run
 *   MONGODB_URI=<uri> node scripts/upload-program-art.mjs <dir> --apply     # uploads + writes
 *   … --apply --replace                                                     # also overwrite an existing thumbnail
 *
 * <dir> holds `<course-slug>.webp` files (scripts/optimize-art.mjs output).
 * A course is matched by `slug`. The object key carries the file's content
 * hash, so a re-run with the same file is a no-op and a new file never serves
 * from a stale cache. Never deletes an object or a course. Without --replace a
 * course that already has a thumbnail is skipped — an instructor's own upload
 * always wins.
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line (the
 * backfill-certificate-ids.mjs rule). R2 credentials come from the env files.
 * Raw collection writes don't bump updatedAt.
 */
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import mongoose from "mongoose"
import { config } from "dotenv"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already set.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const dir = process.argv[2]
const APPLY = process.argv.includes("--apply")
const REPLACE = process.argv.includes("--replace")

if (!dir || dir.startsWith("--")) {
  console.error("usage: MONGODB_URI=<uri> node scripts/upload-program-art.mjs <dir> [--apply] [--replace]")
  process.exit(1)
}
if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  process.exit(1)
}
const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}
const { CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
if (APPLY && !(CLOUDFLARE_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL)) {
  console.error("REFUSING --apply: the R2 env (account, keys, R2_BUCKET_NAME, R2_PUBLIC_URL) is incomplete.")
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db
console.log(`Target: ${uri.replace(/\/\/[^@/]+@/, "//***@")} · database ${db.databaseName} · URI from ${EXPLICIT_URI ? "command line" : ".env file"}`)
console.log(`Bucket: ${R2_BUCKET_NAME ?? "(unset)"} · Mode: ${APPLY ? "APPLY" : "dry run"}${REPLACE ? " + replace" : ""}`)

const courses = db.collection("courses")
const published = await courses
  .find({ status: "published" }, { projection: { slug: 1, title: 1, thumbnailUrl: 1 } })
  .toArray()
const bySlug = new Map(published.map((c) => [c.slug, c]))

const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".webp"))
const s3 = APPLY
  ? new S3Client({
      region: "auto",
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : null

let written = 0
for (const file of files) {
  const slug = path.parse(file).name
  const course = bySlug.get(slug)
  if (!course) {
    console.log(`SKIP  ${file} — no published course with slug "${slug}"`)
    continue
  }
  if (course.thumbnailUrl && !REPLACE) {
    console.log(`KEEP  ${slug} — already has a thumbnail (pass --replace to overwrite)`)
    continue
  }
  const body = await readFile(path.join(dir, file))
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 8)
  // Prefix matches lib/r2.ts generateFileKey: worldstreet-academy/<folder>/… ("thumbnails" for images).
  const key = `worldstreet-academy/thumbnails/programs/${slug}-${hash}.webp`
  const url = `${R2_PUBLIC_URL ?? "<R2_PUBLIC_URL>"}/${key}`
  if (course.thumbnailUrl === url) {
    console.log(`SAME  ${slug} — this exact file is already live`)
    continue
  }
  console.log(`${APPLY ? "WRITE" : "WOULD"} ${slug} → ${url} (${Math.round(body.length / 1024)} KB)`)
  if (!APPLY) continue
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  await courses.updateOne({ _id: course._id }, { $set: { thumbnailUrl: url } })
  written++
}

const covered = new Set(files.map((f) => path.parse(f).name))
for (const course of published) {
  if (!covered.has(course.slug) && !course.thumbnailUrl) console.log(`OWED  ${course.slug} — no file and no thumbnail (shows its school cover)`)
}
console.log(`${written} thumbnail(s) written.`)
await mongoose.disconnect()
