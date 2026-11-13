/**
 * Move staff tutor applicants' uploaded CVs and additional PDFs out of the
 * PUBLIC R2 bucket into the PRIVATE resources bucket (2026-11-12).
 *
 * Until 2026-11-12 getDocumentUploadUrl (lib/actions/upload.ts) put every
 * application PDF in the public bucket under `worldstreet-academy/documents/`
 * and stored its public URL on `instructorapplications.answers.cvUrl` /
 * `.extraDocumentUrl`, so anyone holding the link could open the CV. New
 * uploads go to the private bucket and store only a key (`answers.cvKey` /
 * `.extraDocumentKey`), opened through a 5-minute signed link
 * (getApplicationDocumentUrl in lib/actions/applications.ts). This moves the
 * old ones.
 *
 *   MONGODB_URI=<uri> node scripts/move-applicant-docs-private.mjs                          # dry run
 *   MONGODB_URI=<uri> node scripts/move-applicant-docs-private.mjs --apply                  # copy + record keys
 *   MONGODB_URI=<uri> node scripts/move-applicant-docs-private.mjs --apply --delete-public  # then delete the public copies
 *
 * Step 1 (--apply). For each application whose cvUrl / extraDocumentUrl is a
 * public-bucket URL under worldstreet-academy/documents/ and that has no key yet:
 *   1. HEAD the public object (missing: reported, nothing recorded);
 *   2. copy it (GET from the public bucket, PUT to the private one) to
 *      `worldstreet-academy/applications/<applicant id>/migrated-<old file name>`
 *      (lib/r2.ts applicationDocumentKeyPrefix). The key is fixed, so a re-run
 *      after a crash rewrites the same object;
 *   3. HEAD the copy: same size, and the same MD5 ETag when both have one;
 *   4. record the key, only while the row still holds that URL and no key.
 *   The old URL stays (the app ignores it once a key is set), so the move can
 *   be checked on /admin/applications before anything is deleted.
 *
 * Step 2 (--apply --delete-public). For each application with a recorded key
 * whose URL is still a public-bucket documents URL, grouped by public object:
 *   1. hold the object if any application still points at it without a key;
 *   2. HEAD every private copy: it must exist, be non-empty, and match the
 *      public object's size while that still exists;
 *   3. delete the public object and HEAD it again to confirm it's gone (an
 *      object already gone from an earlier run is fine);
 *   4. clear the URL field (null), only while the row still holds that key and URL.
 *
 * Never touched, only listed: a pasted link (Google Drive, Dropbox…), and a
 * public-bucket URL outside worldstreet-academy/documents/ (a thumbnail, say).
 * A URL that contains worldstreet-academy/documents/ on another base URL is
 * listed as CHECK (an older R2_PUBLIC_URL?) and not moved.
 *
 * ORDER: deploy the app that reads cvKey first. Run --delete-public only once
 * that version is live: an older build shows the CV only through the URL step 2
 * clears. The Go API reads the same collection and doesn't know cvKey yet.
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line (the
 * backfill-certificate-ids.mjs rule). --apply also needs the whole R2 env
 * (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME, R2_PUBLIC_URL, R2_RESOURCES_BUCKET_NAME — from the env files
 * or the command line) and refuses when the private bucket is unset or is the
 * public one. A dry run writes nothing; with R2 credentials present it HEADs
 * the public objects (read-only) to report their size. Idempotent: a re-run
 * only picks up what is left. No secret is printed. Raw collection writes
 * don't bump updatedAt.
 */
import mongoose from "mongoose"
import { config } from "dotenv"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already set.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
const DELETE_PUBLIC = process.argv.includes("--delete-public")
const USAGE = "usage: MONGODB_URI=<uri> node scripts/move-applicant-docs-private.mjs [--apply [--delete-public]]"

const unknown = process.argv.slice(2).filter((a) => a !== "--apply" && a !== "--delete-public")
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(" ")}\n${USAGE}`)
  process.exit(1)
}
if (DELETE_PUBLIC && !APPLY) {
  console.error("REFUSING --delete-public without --apply: it deletes objects. A dry run already lists what step 2 would delete.")
  console.error(`  ${USAGE}`)
  process.exit(1)
}
if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  console.error(`  ${USAGE}`)
  process.exit(1)
}
const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}

const {
  CLOUDFLARE_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  R2_RESOURCES_BUCKET_NAME,
} = process.env
if (!R2_PUBLIC_URL) {
  console.error("R2_PUBLIC_URL is not set — can't tell which URLs point at the public bucket. Refusing to run.")
  process.exit(1)
}
const r2Complete = Boolean(CLOUDFLARE_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME)
if (APPLY && !(r2Complete && R2_RESOURCES_BUCKET_NAME)) {
  console.error(
    "REFUSING --apply: the R2 env (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_RESOURCES_BUCKET_NAME) is incomplete."
  )
  process.exit(1)
}
if (R2_RESOURCES_BUCKET_NAME && R2_RESOURCES_BUCKET_NAME === R2_BUCKET_NAME) {
  console.error("REFUSING: R2_RESOURCES_BUCKET_NAME is the public bucket. The private bucket must be a different bucket with no public access.")
  process.exit(1)
}

const PUBLIC_BASE = R2_PUBLIC_URL.replace(/\/+$/, "")
// lib/actions/upload.ts getDocumentUploadUrl before 2026-11-12: worldstreet-academy/documents/<ms>-<base36>.pdf
const LEGACY_FOLDER = "worldstreet-academy/documents/"
// lib/r2.ts applicationDocumentKeyPrefix — keep equal.
const applicantPrefix = (userId) => `worldstreet-academy/applications/${userId}/`
const FIELDS = [
  { url: "cvUrl", key: "cvKey", label: "CV" },
  { url: "extraDocumentUrl", key: "extraDocumentKey", label: "additional document" },
]

const s3 = r2Complete
  ? new S3Client({
      region: "auto",
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : null

await mongoose.connect(uri)
const db = mongoose.connection.db
console.log(
  `Target: ${uri.replace(/\/\/[^@/]+@/, "//***@")} · database ${db.databaseName} · URI from ${EXPLICIT_URI ? "command line" : ".env file"}`
)
console.log(
  `Public bucket: ${R2_BUCKET_NAME ?? "(unset)"} · private bucket: ${R2_RESOURCES_BUCKET_NAME ?? "(unset)"} · Mode: ${APPLY ? "APPLY" : "dry run"}${DELETE_PUBLIC ? " + delete public copies" : ""}`
)
if (!APPLY && !s3) console.log("(No R2 credentials: the dry run lists from the database only.)")

const applications = db.collection("instructorapplications")

/** The legacy public object key a URL points at, or why it isn't one. */
function classify(url) {
  if (typeof url !== "string" || !url.trim()) return { kind: "none" }
  if (url.startsWith(`${PUBLIC_BASE}/`)) {
    let key
    try {
      key = decodeURIComponent(url.slice(PUBLIC_BASE.length + 1).split(/[?#]/)[0])
    } catch {
      return { kind: "check", why: "public-bucket URL that doesn't decode" }
    }
    const name = key.slice(LEGACY_FOLDER.length)
    if (key.startsWith(LEGACY_FOLDER) && /^[A-Za-z0-9._-]{1,200}$/.test(name) && !name.includes("..")) {
      return { kind: "public", srcKey: key, name }
    }
    return { kind: "other-public" }
  }
  if (url.includes(`/${LEGACY_FOLDER}`)) return { kind: "check", why: "an uploaded PDF on another base URL" }
  return { kind: "link" }
}

/** A key that may be signed for this applicant (lib/actions/applications.ts isApplicantDocumentKey). */
function isApplicantKey(key, userId) {
  if (typeof key !== "string") return false
  const prefix = applicantPrefix(userId)
  const name = key.slice(prefix.length)
  return key.startsWith(prefix) && /^[A-Za-z0-9._-]{1,200}$/.test(name) && !name.includes("..")
}

function hostOf(url) {
  try {
    return new URL(url).host || "(no host)"
  } catch {
    return "(not a URL)"
  }
}

/** HEAD an object: { size, etag, contentType } or null when it doesn't exist. */
async function head(bucket, key) {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { size: Number(res.ContentLength ?? -1), etag: res.ETag ?? "", contentType: res.ContentType ?? "" }
  } catch (err) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return null
    throw err
  }
}

/** Both ETags are plain single-part MD5s (not multipart) and differ. */
function etagsDiffer(a, b) {
  const md5 = (e) => e.replace(/"/g, "").toLowerCase()
  const plain = (e) => /^[a-f0-9]{32}$/.test(md5(e))
  return plain(a) && plain(b) && md5(a) !== md5(b)
}

const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`

async function loadRows() {
  return applications
    .find(
      {
        $or: [
          { "answers.cvUrl": { $nin: [null, ""] } },
          { "answers.extraDocumentUrl": { $nin: [null, ""] } },
        ],
      },
      { projection: { user: 1, status: 1, "answers.cvUrl": 1, "answers.cvKey": 1, "answers.extraDocumentUrl": 1, "answers.extraDocumentKey": 1 } }
    )
    .toArray()
}

const counts = {
  rows: 0,
  links: 0,
  otherPublic: 0,
  check: 0,
  move: 0,
  moved: 0,
  recorded: 0,
  missing: 0,
  failed: 0,
  changed: 0,
  badUser: 0,
  deleted: 0,
  cleared: 0,
  held: 0,
}

/* ───────────── Step 1: copy and record keys ───────────── */

const rows = await loadRows()
counts.rows = rows.length
console.log(`\nStep 1 · ${rows.length} application(s) with a CV or additional-document URL`)

for (const app of rows) {
  const id = app._id.toString()
  const userId = app.user?.toString() ?? ""
  for (const field of FIELDS) {
    const url = app.answers?.[field.url]
    const where = `${id} · ${field.label}`
    const c = classify(url)
    if (c.kind === "none") continue
    if (c.kind === "link") {
      console.log(`LINK   ${where} · pasted link on ${hostOf(url)} — left as is`)
      counts.links++
      continue
    }
    if (c.kind === "other-public") {
      console.log(`SKIP   ${where} · public-bucket URL outside ${LEGACY_FOLDER} — not an application upload, left as is`)
      counts.otherPublic++
      continue
    }
    if (c.kind === "check") {
      console.log(`CHECK  ${where} · ${c.why} (${hostOf(url)}) — not moved`)
      counts.check++
      continue
    }
    if (!/^[a-f0-9]{24}$/.test(userId)) {
      console.log(`SKIP   ${where} · application has no valid applicant id`)
      counts.badUser++
      continue
    }
    const existingKey = app.answers?.[field.key]
    if (existingKey) {
      if (isApplicantKey(existingKey, userId)) {
        console.log(`DONE   ${where} · key recorded; public copy ${DELETE_PUBLIC ? "handled in step 2" : "awaits --delete-public"}`)
        counts.recorded++
      } else {
        console.log(`CHECK  ${where} · has a key outside the applicant's folder — not touched`)
        counts.check++
      }
      continue
    }

    const destKey = `${applicantPrefix(userId)}migrated-${c.name}`
    if (!APPLY) {
      let note = ""
      if (s3) {
        const src = await head(R2_BUCKET_NAME, c.srcKey)
        note = src ? ` (${kb(src.size)})` : " · PUBLIC OBJECT MISSING — would be reported, not recorded"
        if (!src) counts.missing++
      }
      console.log(`WOULD  ${where} · ${c.srcKey} → private ${destKey}${note}`)
      counts.move++
      continue
    }

    counts.move++
    const src = await head(R2_BUCKET_NAME, c.srcKey)
    if (!src) {
      console.log(`MISSING ${where} · public object ${c.srcKey} doesn't exist — nothing recorded`)
      counts.missing++
      continue
    }
    try {
      const got = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: c.srcKey }))
      const body = await got.Body.transformToByteArray()
      if (body.length !== src.size) {
        console.log(`FAILED ${where} · read ${body.length} bytes, expected ${src.size} — nothing recorded`)
        counts.failed++
        continue
      }
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_RESOURCES_BUCKET_NAME,
          Key: destKey,
          Body: body,
          ContentLength: body.length,
          // Every upload was signed as a PDF; the private copy is served as one whatever the old object says.
          ContentType: "application/pdf",
        })
      )
      const copy = await head(R2_RESOURCES_BUCKET_NAME, destKey)
      if (!copy || copy.size !== src.size || etagsDiffer(copy.etag, src.etag)) {
        console.log(`FAILED ${where} · private copy didn't verify (size ${copy?.size ?? "none"} vs ${src.size}) — nothing recorded`)
        counts.failed++
        continue
      }
      const res = await applications.updateOne(
        { _id: app._id, [`answers.${field.url}`]: url, [`answers.${field.key}`]: null },
        { $set: { [`answers.${field.key}`]: destKey } }
      )
      if (res.modifiedCount === 1) {
        const type = src.contentType && src.contentType !== "application/pdf" ? ` · old object said ${src.contentType}` : ""
        console.log(`MOVED  ${where} · ${c.srcKey} → private ${destKey} (${kb(src.size)})${type}`)
        counts.moved++
      } else {
        console.log(`CHANGED ${where} · the row changed while running — private copy left, nothing recorded`)
        counts.changed++
      }
    } catch (err) {
      console.log(`FAILED ${where} · ${err?.name ?? "error"}: ${err?.message ?? err} — nothing recorded`)
      counts.failed++
    }
  }
}

/* ───────────── Step 2: delete verified public copies, clear the URLs ───────────── */

/** Every reference to a legacy public object, from a fresh read (step 1 may have just recorded keys). */
async function publicReferences() {
  const byObject = new Map() // srcKey -> [{ app, field, url, key, userId }]
  for (const app of await loadRows()) {
    const userId = app.user?.toString() ?? ""
    for (const field of FIELDS) {
      const url = app.answers?.[field.url]
      const c = classify(url)
      if (c.kind !== "public") continue
      const refs = byObject.get(c.srcKey) ?? []
      refs.push({ app, field, url, key: app.answers?.[field.key] ?? null, userId })
      byObject.set(c.srcKey, refs)
    }
  }
  return byObject
}

if (!APPLY) {
  // Preview only: what --apply --delete-public would delete today (before this run's moves).
  const ready = [...(await publicReferences()).entries()].filter(([, refs]) => refs.every((r) => isApplicantKey(r.key, r.userId)))
  console.log(`\nStep 2 preview · ${ready.length} public object(s) already have a recorded private copy (deleted by --apply --delete-public)`)
  for (const [srcKey, refs] of ready) {
    console.log(`READY  ${srcKey} · ${refs.map((r) => `${r.app._id.toString()} ${r.field.label}`).join(", ")}`)
  }
} else if (DELETE_PUBLIC) {
  const byObject = await publicReferences()
  console.log(`\nStep 2 · ${byObject.size} public object(s) still referenced`)
  for (const [srcKey, refs] of byObject) {
    const names = refs.map((r) => `${r.app._id.toString()} ${r.field.label}`).join(", ")
    const unrecorded = refs.filter((r) => !isApplicantKey(r.key, r.userId))
    if (unrecorded.length > 0) {
      console.log(`HOLD   ${srcKey} · ${unrecorded.length} reference(s) without a recorded private copy (${names})`)
      counts.held++
      continue
    }
    try {
      const pub = await head(R2_BUCKET_NAME, srcKey)
      let verified = true
      for (const r of refs) {
        const copy = await head(R2_RESOURCES_BUCKET_NAME, r.key)
        if (!copy || copy.size <= 0 || (pub && copy.size !== pub.size)) {
          console.log(`HOLD   ${srcKey} · private copy ${r.key} missing or a different size (${copy?.size ?? "none"} vs ${pub?.size ?? "gone"})`)
          verified = false
          break
        }
      }
      if (!verified) {
        counts.held++
        continue
      }
      if (pub) {
        await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: srcKey }))
        if (await head(R2_BUCKET_NAME, srcKey)) {
          console.log(`FAILED ${srcKey} · still there after the delete — URLs kept`)
          counts.failed++
          continue
        }
        console.log(`DELETED ${srcKey} (public)`)
        counts.deleted++
      } else {
        console.log(`GONE   ${srcKey} · already deleted from the public bucket`)
      }
      for (const r of refs) {
        const res = await applications.updateOne(
          { _id: r.app._id, [`answers.${r.field.key}`]: r.key, [`answers.${r.field.url}`]: r.url },
          { $set: { [`answers.${r.field.url}`]: null } }
        )
        if (res.modifiedCount === 1) {
          console.log(`CLEARED ${r.app._id.toString()} · ${r.field.label} URL (private key ${r.key} kept)`)
          counts.cleared++
        } else {
          console.log(`CHANGED ${r.app._id.toString()} · ${r.field.label} changed while running — URL left`)
          counts.changed++
        }
      }
    } catch (err) {
      console.log(`FAILED ${srcKey} · ${err?.name ?? "error"}: ${err?.message ?? err}`)
      counts.failed++
    }
  }
}

console.log(`\n${"-".repeat(60)}`)
console.log(
  [
    `applications ${counts.rows}`,
    `${APPLY ? "to move" : "would move"} ${counts.move}`,
    APPLY ? `moved ${counts.moved}` : null,
    `already recorded ${counts.recorded}`,
    `public object missing ${counts.missing}`,
    `pasted links left ${counts.links}`,
    counts.otherPublic ? `other public URLs left ${counts.otherPublic}` : null,
    counts.check ? `to check by hand ${counts.check}` : null,
    counts.badUser ? `no applicant ${counts.badUser}` : null,
    DELETE_PUBLIC ? `public deleted ${counts.deleted}` : null,
    DELETE_PUBLIC ? `URLs cleared ${counts.cleared}` : null,
    DELETE_PUBLIC ? `held ${counts.held}` : null,
    counts.changed ? `changed while running ${counts.changed}` : null,
    counts.failed ? `FAILED ${counts.failed}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
)
if (!APPLY) console.log("\nDRY RUN — nothing copied, written or deleted. Re-run with MONGODB_URI=<uri> … --apply")
else if (!DELETE_PUBLIC) console.log("\nPublic copies kept. Check a few on /admin/applications, then re-run with --apply --delete-public.")
if (counts.failed > 0) process.exitCode = 1

await mongoose.disconnect()
