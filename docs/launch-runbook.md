# WorldStreet Mastery Academy — production launch runbook

**For:** the owner. Every step here touches production or another repository, so nobody runs it but you. The repository side (SEO, legal links, docs) is already on the release branch.
**Release:** `mastery/phase-8` — Mastery Academy Phases 0–6 plus the launch work. Phase 7 (Executive services) is not in this release.
**Written:** 2026-09-14. **Specs:** `docs/mastery-academy-plan.md` (§0.4, Phase 8), `docs/mastery-academy-blueprint.md` §17, `docs/go-patches-phase-3.md`.

Do the steps in order. Each ends with a **Check**; don't start the next step until it passes. Keep every log this runbook tells you to `tee` — rollback (§9) needs them — and keep them out of the repository.

## Conventions

- Use Git Bash (or any POSIX shell), in a checkout of the exact commit Coolify deploys.
- Production values never go into files or shell history. Load them once per shell:

  ```bash
  read -rs PROD_URI     # paste the production MongoDB URI, press Enter (nothing is echoed)
  SITE=https://academy.worldstreetgold.com
  ```

- **Always put `MONGODB_URI="$PROD_URI"` in front of a script.** Both database scripts load `.env.local` through dotenv, but dotenv never overrides a variable that is already set, so the explicit value decides the target. `scripts/backfill-certificate-ids.mjs --apply` refuses to run without it.
- Scripts run from your checkout, never the container: the runner image copies only `.next`, `public`, `next.config.ts` and the package files, so there is no `scripts/` folder in it. Run `pnpm install --frozen-lockfile` in the checkout first.
- Tools: MongoDB Database Tools (`mongodump --version`) and `mongosh` (`mongosh --version`).
- Some Cloudflare ranges are blocked on the office network. A `curl` that prints `000` means "couldn't connect from here", not "the site is down" — re-check from another network or an external checker.

## 0. Blockers — settle these first

| # | Item | Who | Blocks launch? |
|---|---|---|---|
| B1 | **Go API patches** R1–R10 in `docs/go-patches-phase-3.md` built and ready to deploy (§2), and that document's §4 questions answered. | Backend owner | **Yes** — unless you decide in writing to launch the web app with every lesson's `minPackageKey` unset (the catalogue script never sets it; set no lesson tiers in the editor until Go ships), accepting that mobile can open Standard lessons and issue certificates to Basic buyers until Go lands. |
| B2 | **Price sign-off (plan D3).** The catalogue `--apply` (§6) sets each spec-ladder program's course price from its packages. The script's own header says Forex and Crypto go 199 → 49 (their Basic package) and AI & AI Automation goes 99 → 199. The §6 dry run prints the real `current -> derived` lines; product signs those lines. | Product | **Yes** |
| B3 | **Wallet env.** `WALLET_BASE_URL` and `WALLET_SERVICE_TOKEN` set in Coolify (§3). Without them every purchase fails closed. | You | **Yes** |
| B4 | **Legal coverage.** The Academy footer links the hub's Terms of Business, Privacy Policy and Cookie Policy (`https://www.worldstreetgold.com/legal` says each applies across every platform on one login). Ask the documents' owner to confirm they cover what the Academy does: public certificate pages (`/verify/<id>`) showing a student's name, program, school, instructor and completion date; public faculty profiles; homepage testimonials with photo, name, country and program; the OpenAI-powered voice assistant; the Google Translate widget; RealtimeKit classes and calls; email through Resend; files on Cloudflare R2. | You + legal | Your call |
| B5 | **QA account and program.** A real WorldStreet account with enough wallet balance for the §8 purchase, and a program with at least one published lesson. The plan's journey is Forex Standard; if Forex has no published lessons yet, use a program that does and note it in the run log. | You | **Yes** for §8 |

## 1. Backup

```bash
mongodump --uri="$PROD_URI" --gzip --archive="academy-prelaunch-$(date +%Y%m%d-%H%M).archive.gz"
mongosh "$PROD_URI" --quiet --eval 'print("db " + db.getName()); print("published " + db.courses.countDocuments({ status: "published" })); print("with school " + db.courses.countDocuments({ school: { $type: "string" } })); print("orphans " + db.enrollments.countDocuments({ course: { $nin: db.courses.distinct("_id") } }))' | tee "counts-before-$(date +%Y%m%d-%H%M).log"
```

**Check:** `mongodump` prints `done dumping <db>.courses`, `.enrollments`, `.orders` and `.users`; `ls -lh academy-prelaunch-*.gz` shows a non-empty archive; the counts log has four lines. If your MongoDB host takes snapshots, take one too and note its id.

## 2. Go API — deploy before the web app

Every Go rule reads a missing field as full access, so the patches are safe against today's data. They must be live before the web app sells packages, or mobile opens what a package doesn't include.

1. Deploy the Go release with R1–R10 from `docs/go-patches-phase-3.md` — including R10's category change: once §6 runs, `courses.category` holds school labels, so a mobile filter on the old strings must already use `courses.school`.
2. **Check:** in the mobile app, a legacy enrollment still opens all of its lessons and the course list loads. The full matrix runs in §8, once the catalogue exists.

## 3. Coolify environment (academy app)

Coolify → the academy application → Environment Variables. Names only here; values live in Coolify.

| Name | Needed | Read at | Notes |
|---|---|---|---|
| `WALLET_BASE_URL`, `WALLET_SERVICE_TOKEN` | Yes | Runtime | Missing either → purchases fail closed and `/api/cron/earnings` answers `503 wallet_disabled`. |
| `SITE_URL` | Yes | Runtime | `https://academy.worldstreetgold.com`, no trailing slash. `lib/app-url.ts` builds email links, canonical URLs, the sitemap, share-card URLs and certificate verify URLs from it. |
| `NEXT_PUBLIC_APP_URL` | Optional | Runtime (server) | If set, it wins over `SITE_URL` — make it the same public origin. A localhost value is ignored in production. |
| `NEXT_PUBLIC_COMMUNITY_URL` | Optional | **Build** | The dashboard's Community tile reads it in the browser, so Next bakes it in during the build: tick "Build Variable" and redeploy after any change. Unset → the tile is hidden. |
| `CRON_SECRET` | Yes | Runtime | A long random value (`openssl rand -hex 32`). The three scheduled tasks (§5) send it as a bearer token. |

Also confirm these existing names are present (don't change working values): `MONGODB_URI`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_WALLET_FUNDING_URL`, `NEXT_PUBLIC_WALLET_WITHDRAW_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ABLY_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_REALTIME_ORG_ID`, `CLOUDFLARE_REALTIME_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_RESOURCES_BUCKET_NAME` (that bucket must have no public access), `R2_PUBLIC_URL`, `OPENAI_API_KEY`.

**Check:** after §4, `curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SITE/api/cron/course-live"` prints `401` (route live, secret required).

## 4. Deploy the web app

1. Confirm Coolify → academy app → Source deploys `main`.
2. Push the release branch and open the PR:

   ```bash
   git push -u origin mastery/phase-8
   gh pr create --base main --head mastery/phase-8 --title "WorldStreet Mastery Academy — Phases 0–6 and launch" --body "Release steps: docs/launch-runbook.md"
   ```

3. Merge after review; Coolify builds and deploys.

**Check — build log:** the route table lists `○ /opengraph-image`, `○ /robots.txt` and `ƒ /sitemap.xml`; the first minutes of runtime logs show no `E11000` and no `Index build failed`.

**Check — pages:**

```bash
for p in / /schools /schools/trading-financial-markets /programs /faculty /robots.txt /sitemap.xml /opengraph-image; do
  printf "%-40s " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$SITE$p"
done
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$SITE/courses"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$SITE/dashboard"
curl -s "$SITE/verify/WSA-00000000" | grep -o "No certificate with this ID" | head -1
curl -s "$SITE/robots.txt"
```

Expect: `200` for every path (`text/plain` for robots, `application/xml` for the sitemap, `image/png` for the card; `/faculty` is 200 even with no faculty yet); `308 https://academy.worldstreetgold.com/programs`; `307 https://www.worldstreetgold.com/login?redirect=…`; the "No certificate" line; a robots file ending `Sitemap: https://academy.worldstreetgold.com/sitemap.xml`.

**Check — footer legal links** (all `200`; if one isn't, fix `components/marketing/footer.tsx` before launch — never ship a dead link):

```bash
for u in "https://www.worldstreetgold.com/legal-docs/WS%20Terms%20of%20Business.pdf" "https://www.worldstreetgold.com/legal-docs/Privacy%20Policy.pdf" "https://www.worldstreetgold.com/legal-docs/WS%20Cookie%20Policy%201.pdf" "https://www.worldstreetgold.com/legal"; do
  printf "%s %s\n" "$(curl -s -o /dev/null -w "%{http_code}" "$u")" "$u"
done
```

**Check — certificate index (Phase 6):** Mongoose builds it the first time the app touches enrollments after the deploy. Sign in and open `/dashboard`, then:

```bash
mongosh "$PROD_URI" --quiet --eval 'printjson(db.enrollments.getIndexes().filter(i => i.name === "certificateId_1"))'
```

Expect one index with `unique: true` and `partialFilterExpression: { certificateId: { '$type': 'string' } }`. If it is still missing after 10 minutes, create exactly that index:

```bash
mongosh "$PROD_URI" --quiet --eval 'db.enrollments.createIndex({ certificateId: 1 }, { unique: true, partialFilterExpression: { certificateId: { $type: "string" } } })'
```

Never create it `sparse`: new enrollments store `certificateId: null`, a sparse unique index still indexes that null, and the second new enrollment — a purchase — would fail.

## 5. Scheduled tasks (Coolify)

All three routes under `app/api/cron/` are `POST`, require `Authorization: Bearer $CRON_SECRET`, and are idempotent.

| Task | Path | Cron | What it does |
|---|---|---|---|
| academy-course-live | `/api/cron/course-live` | `*/5 * * * *` | Emails and notifies pre-enrolled students when a scheduled course goes live; stamps `liveNotifiedAt`. Phase 3 recorded it as not yet scheduled in production. |
| academy-reminders | `/api/cron/reminders` | `*/10 * * * *` | T-24h and T-1h reminders for scheduled classes (students whose package includes live classes) and interviews. |
| academy-earnings | `/api/cron/earnings` | `*/15 * * * *` | Clears matured instructor earnings to the wallet and applies refund clawbacks. |

Coolify → academy app → Scheduled Tasks → Add, container = the academy app. The runner image (`node:22-alpine`) has no `curl`, so call the app from inside its own container with Node (swap the path for each task):

```sh
node -e 'fetch("http://127.0.0.1:3000/api/cron/course-live",{method:"POST",headers:{Authorization:"Bearer "+process.env.CRON_SECRET}}).then(async r=>{console.log(r.status,await r.text());if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})'
```

If reminders or earnings tasks already exist with a `curl` command, open their last run log: `curl: not found` means they have never run — replace them with the command above. If the in-container call returns anything but JSON, use `https://academy.worldstreetgold.com/api/cron/<name>` as the URL in the same command.

**Check:** run each task once ("Run now", or wait one interval). Its log shows `200 {"ok":true,…}`. `401` → `CRON_SECRET` isn't in the container env; `503 {"ok":false,"error":"wallet_disabled"}` (earnings) → `WALLET_*` missing.

## 6. Production catalogue — `scripts/mastery-catalogue.mjs`

What it does (its header): upserts the 12 programs by exact title (scoped to the catalogue owner, with a printed warning on any other match) — sets title, school, category and packages; sets copy only for Forex, Crypto and AI & AI Automation; derives those three programs' course price from their packages; renames "Content Creation / Video Editing Mastery" → "Content Creation Mastery" and "Artificial Intelligence & AI Automation" → "AI & AI Automation". **Not all new inserts are drafts:** each of the 12 program literals carries its own `newInsertDraft` flag (`status = program.newInsertDraft ? "draft" : "published"` — read the script, not this paraphrase, for which); on the current script only 2 of the 12 are flagged `true`, so a title that doesn't already exist in production and isn't one of those 2 goes live as `published` the moment `--apply` runs. Check each `INSERT` line in the dry run against this before applying. It never deletes or archives, aborts on slug drift (`ABORT: slug … exists`), and refuses a price change without `--allow-price-change`.

**Stop condition:** the dry run must list only the two `newInsertDraft` programs as `INSERT` lines. Any other `INSERT` means a title in production doesn't match what the script expects (a slug or title mismatch with production) — stop and investigate before `--apply`; do not apply against an unexplained insert.

Before: §2 (Go) and §4 (package-aware checkout) are live, and B2 is signed.

```bash
git checkout <the release commit on main> && pnpm install --frozen-lockfile
MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs | tee "catalogue-dryrun-$(date +%Y%m%d-%H%M).log"
```

**Review the dry run:**
- `Target database:` is the production database (same name as `db` in §1's counts log).
- The WARNING box's `current -> derived` lines are exactly what product signed (B2).
- Every `MATCH`/`RENAME` line's `_id`, status, owner email and price is the row you expect. No `WARN adopted row owned by`, no `WARN duplicate title`, no `ABORT`.
- The summary reads `matched M / renamed R / inserted I / skipped 0`, with no `WARN: planned actions … do not add up`.

**Apply** (`--allow-price-change` is needed only when the dry run shows a price change; without it the run exits 1 before writing):

```bash
MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs --apply --allow-price-change | tee "catalogue-apply-$(date +%Y%m%d-%H%M).log"
```

**Check:**

```bash
MONGODB_URI="$PROD_URI" node scripts/mastery-catalogue.mjs --apply | tail -3     # idempotent re-run
mongosh "$PROD_URI" --quiet --eval 'print("published " + db.courses.countDocuments({ status: "published" })); print("with school " + db.courses.countDocuments({ school: { $type: "string" } })); print("orphans " + db.enrollments.countDocuments({ course: { $nin: db.courses.distinct("_id") } }))'
curl -s "$SITE/schools/trading-financial-markets" | grep -o 'href="/programs/[^"]*"' | sort -u
```

- The re-run prints `Inserted 0` and `Total modifiedCount across matched rows: 0`.
- `with school` is at least 12, and `orphans` equals §1's value (the script can't orphan anything).
- The school page links the Forex and Crypto programs. `curl -s "$SITE/programs/<forex slug>" | grep -o 'Forex Foundation\|Forex Mastery\|Private Forex Mentorship' | sort -u` prints all three package names.
- A student with an old enrollment still sees it on `/dashboard/my-courses`.

## 7. Certificate IDs — `scripts/backfill-certificate-ids.mjs`

What it does: stores the legacy ID certificates have always printed (`WSA-<last 8 characters of the enrollment _id, uppercased>`) on completed, certificate-entitled enrollments that have none, so PDFs already downloaded verify at `/verify/<id>`. It skips Basic completions, reports collisions and never overwrites. `--apply` refuses without an explicit `MONGODB_URI`.

Before: §4's index check passed.

```bash
MONGODB_URI="$PROD_URI" node scripts/backfill-certificate-ids.mjs | tee "certids-dryrun-$(date +%Y%m%d-%H%M).log"
```

**Review:**
- the `WOULD SET <enrollment id> → WSA-…` lines;
- each `COLLISION` line: two enrollments share their last 8 id characters, so the skipped one's printed ID belongs to the other. Decide by hand which student keeps it, and don't hand-write a duplicate;
- the summary `candidates … · would set … · no certificate … · course missing … · collisions …`.

```bash
MONGODB_URI="$PROD_URI" node scripts/backfill-certificate-ids.mjs --apply | tee "certids-apply-$(date +%Y%m%d-%H%M).log"
```

**Check:**
- Re-run the same `--apply`. The summary shows `set 0`; only `SKIP`/`COLLISION` lines remain.
- Take one `SET … → WSA-XXXXXXXX` from the apply log. `curl -s "$SITE/verify/WSA-XXXXXXXX" | grep -o 'Valid' | head -1` prints `Valid`, and the page shows that student's name and program.

## 8. §17 journey QA — production, real wallet-funded account

Use a private browser window, signed out of worldstreetgold.com. Keep a run log: date, account email, program and package, the order reference from `/admin/payments`, and screenshots of steps 7, 11 and 12.

| # | §17 step | Do | Pass when |
|---|---|---|---|
| 1 | Homepage | Open `https://academy.worldstreetgold.com/` | Hero "Learn Skills. Build Value. Own Your Future."; no browser console errors. |
| 2 | Explore Our Schools | "Explore programs" | `/schools`: eight school cards with program counts. |
| 3 | Select School | Trading & Financial Markets | `/schools/trading-financial-markets` lists Forex and Crypto. |
| 4 | View Programs → Select Program | "View program" on Forex (or your B5 program) | `/programs/<slug>` opens. |
| 5 | Program Details → View Curriculum | Scroll | Hero, "What you will learn", the instructor block (its name links to `/faculty/<username>`), FAQ. |
| 6 | Choose Package → View Price | The package ladder | Basic, Standard and Executive cards at the prices signed in B2. |
| 7 | ENROL NOW | Standard's enrol button | Signed out → `www.worldstreetgold.com/login?redirect=https://academy.worldstreetgold.com/dashboard/checkout?courseId=…&package=standard`. |
| 8 | Create/Login to WorldStreet Account | Sign in (or register) the QA account | Back on the Academy checkout with `package=standard` — the satellite return works on the real origin (plan Risk 6). |
| 9 | Checkout | Review, then pay | Package summary (name, tagline, price), wallet balance, package switcher. |
| 10 | Payment Successful | — | The wallet is debited the Standard price exactly once (hub wallet transactions). |
| 11 | Enrollment Confirmed | Success page | "Enrollment confirmed" and "Your learning journey starts now." with the package name; the confirmation email arrives and names the package. |
| 12 | Student Dashboard | "Go to dashboard" | `/dashboard?welcome=1` shows "Welcome to WorldStreet Mastery Academy" and the gold Continue learning button. |
| 13 | START LEARNING | Continue learning | The first lesson plays; lessons the Standard package opens play; an Executive-only lesson, if any, shows the lock card. |

Then:
- `/admin/payments` shows the order with package `standard` and the amount; `/admin/enrollments` shows the enrollment.
- Reloading checkout for the same package doesn't charge again.
- Share previews: paste `$SITE/` and the program URL into a link-preview debugger. The homepage shows the brand card; a program with a thumbnail shows its thumbnail.
- `/faculty` and one profile render; the footer's legal links open; `/verify/<an ID from §7>` shows Valid.
- **Mobile (Go, `docs/go-patches-phase-3.md` §3 matrix):**
  - With the QA Standard enrollment, Standard lessons open, an Executive-only lesson is locked, and the final exam can start.
  - In `/admin/enrollments`, change that enrollment's package to Basic. The change is audited and moves no money. Mobile now locks Standard lessons, refuses the final exam and shows no certificate.
  - Change it back to Standard, and confirm a legacy enrollment still opens everything.

## 9. Rollback

**Code:** Coolify → academy app → Deployments → the last pre-launch deployment → Redeploy. Alternatively revert the merge on `main` (`git revert -m 1 <merge sha> && git push origin main`) and let Coolify rebuild.

**Data** is additive, except the catalogue's prices:
- **If §6 ran and the web app goes back to pre-package code, restore the course prices first.** The old checkout charges the course price for full access, and §6 lowered Forex and Crypto to their Basic price. For each program in the dry-run log's WARNING box, take its `_id` from its `MATCH` line and its old price from the box, then:

  ```bash
  mongosh "$PROD_URI" --quiet --eval 'printjson(db.courses.updateOne({ _id: ObjectId("<_id>") }, { $set: { price: <old price> } }))'
  ```

  Expect `modifiedCount: 1` for each.
- Everything else §6 wrote (school, packages, category label, the two renamed titles, draft inserts) is ignored or cosmetic under old code. Leave it.
- `certificateId` values and their partial index are ignored by old code, and enrollments it creates omit the field, which the partial index doesn't cover. Leave them.
- **Go:** rolling Go back reopens mobile tier bypass for package enrollments. Roll Go back only together with the web app, after restoring prices.
- **Last resort**, and only by your decision: restore one collection from §1's archive with `mongorestore --uri="$PROD_URI" --gzip --archive=<file> --nsInclude="<db>.courses" --drop`. It discards every change to that collection since the backup (enrolment counts, ratings…).

## 10. Other repositories (non-blocking)

- **`../design-system`:** plan D1 asked for the lockup eyebrow "ACADEMY" → "MASTERY ACADEMY" in `04-components`. On 2026-09-14 no literal "ACADEMY" appears in `design-system/*.md`, and the code lockup reads `BRAND.eyebrow`. Confirm nothing else needs changing.
- **The hub's legal page:** `https://www.worldstreetgold.com/legal` and `/legal-docs/*.pdf` are live, but neither is in the local `../dashboard-revamp` checkout (`main`, `dev/self-custody-preview`). Ask the hub owner where that page is deployed from, so a hub redeploy can't remove the files the Academy footer links to.
- **Mobile app:** certificate screens print `certificateId` with the legacy fallback (Go doc R9), and course filters use `school` (R10).

## 11. Post-launch cleanup — decide

| Item | What happened | Options |
|---|---|---|
| Two real RealtimeKit rooms | On 2026-09-14 a local Phase 4 check (`pnpm dev:mock` had inherited `.env.local`'s `CLOUDFLARE_REALTIME_*`) created "Meeting: Week 1 live class" and "Meeting: Live now" in the RealtimeKit organization those credentials belong to. The local records were removed; the remote rooms remain. | Leave them, or end them from that organization's RealtimeKit dashboard. The app's own `endMeeting` (`lib/realtime.ts`) sends `DELETE https://api.dyte.io/v2/meetings/<id>` with Basic auth `ORG_ID:API_KEY` but swallows errors, so that call's effect is unverified. |
| Possible Resend emails | Resend was live during Phase 3 and Phase 4 Tasks 1–3 local checks (2026-09-14). Enrollment-confirmation and meeting emails may have gone to the mock addresses `student@`, `instructor@` and `admin@worldstreet.academy`. | Check Resend → Emails for those recipients on that date. Sent mail can't be recalled; if `worldstreet.academy` has real inboxes, tell their owner. |
| The §8 test purchase | A real debit on the QA account. | Refund it from `/admin/payments` (re-credits the wallet, revokes access, reverses the instructor's pending earning), or keep the enrollment. |
| Identity scripts in git history | `link-tmp.cjs` and `link-mobile-identity.cjs` were removed in Phase 8 but stay in history with two Clerk user ids (identifiers, not credentials). | Leave (recommended), or rewrite history. |
| `scripts/_swap-catalogue.mjs` | Superseded by `mastery-catalogue.mjs`. If run with `--apply` it archives courses and inserts the old 10-program catalogue. | Delete it, or keep it with its history. |
| Certificate IDs for mobile completions | Go doesn't stamp `certificateId` yet (Go doc R9). The web stores one the first time the student opens that certificate on the web. | Re-run §7 now and then for mobile completions nobody has opened on the web, until Go stamps IDs. |
| Product debt | School intros, program curricula, thumbnails and instructor bios (Phase 2); the Academy signatory name and signature file (D9); a surface for §13's "LEARN. COMPLETE. GET RECOGNIZED." (Phase 6); real RealtimeKit scheduling run on staging (Phase 4). | Schedule with product. |
