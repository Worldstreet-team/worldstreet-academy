import { NextResponse, type NextRequest } from "next/server"
import { schoolSlugOf } from "@/lib/schools"

/**
 * The in-dashboard "Programs" catalogue is retired (owner, 2026-09-18): a
 * second catalogue beside "My programs" was where learners got lost. Programs
 * are browsed and bought on the public catalogue; old links, bookmarks and the
 * "Browse programs" buttons land there — a `?school=` filter on that school's
 * page. A program's own pages (`/dashboard/courses/<id>/…`) are unaffected.
 *
 * A route handler, not a page: a page's `redirect()` runs after the platform
 * layout has started streaming, so the response was a 200 that logged a hooks
 * mismatch before it landed. This answers with a real 307.
 */
export function GET(request: NextRequest) {
  const target = schoolSlugOf(request.nextUrl.searchParams.get("school"))
  // A relative Location: behind the Coolify proxy the request's own host can be
  // the container's (0.0.0.0:3000), so an absolute URL built from it would leak.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: target ? `/schools/${target}` : "/programs" },
  })
}
