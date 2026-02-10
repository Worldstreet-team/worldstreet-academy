import { NextRequest, NextResponse } from "next/server"
import { endCallByCallId } from "@/lib/actions/calls"

/**
 * Lightweight endpoint for Navigator.sendBeacon on page unload.
 * Ends a call so it doesn't stay stuck as "ongoing" or "ringing" in the DB
 * when the user closes the tab, refreshes, or navigates away.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { callId } = body as { callId?: string }

    if (!callId || typeof callId !== "string") {
      return NextResponse.json({ error: "Missing callId" }, { status: 400 })
    }

    // Fire-and-forget — we don't need to wait for the response
    // since sendBeacon doesn't read it anyway
    await endCallByCallId(callId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
