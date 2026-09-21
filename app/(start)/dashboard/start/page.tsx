import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { START_SCHOOL_COOKIE, schoolsPathFor } from "@/lib/start-gate"

type Search = { searchParams: Promise<{ school?: string | string[]; pick?: string | string[] }> }

/**
 * `/dashboard/start` — retired (owner, 2026-09-18, plan D15). The "Step 1 of
 * 3" picker is gone: the journey is Homepage → School → Program → Package →
 * Checkout (blueprint §17/§18), so the old URL only forwards, keeping every
 * link already out there working. `?school=<slug>` → that school's page;
 * `?pick=1` → all schools; a bare visit honours the landing's `wsa_school`
 * cookie, the same rule as the school-first gate.
 *
 * It stays in its own `(start)` group, outside `(platform)`, so the platform
 * gate never runs on it. Its targets are public pages, so it cannot loop.
 */
export default async function StartRedirect({ searchParams }: Search) {
  const { school, pick } = await searchParams
  if (pick) redirect("/schools")
  const named = Array.isArray(school) ? school[0] : school
  redirect(schoolsPathFor(named ?? (await cookies()).get(START_SCHOOL_COOKIE)?.value))
}
