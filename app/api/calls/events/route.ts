import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { subscribeToEvents, type SSEEventPayload } from "@/lib/call-events"

// IMPORTANT: Mongoose requires Node.js runtime (not Edge)
// SSE on serverless has timeout limits:
// - Vercel Hobby: 10s max
// - Vercel Pro: up to 300s with maxDuration config
// - Alternative: Use Pusher/Ably/WebSocket service for production
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes (requires Vercel Pro or Enterprise)

/**
 * Unified SSE endpoint for real-time events (calls + messages).
 * Clients connect via EventSource and receive all events in real-time.
 *
 * GET /api/calls/events
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const userId = user.id
  console.log(`[SSE] User ${userId} connected`)

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", userId })}\n\n`)
      )

      // Subscribe to ALL events for this user
      unsubscribe = subscribeToEvents(userId, (event: SSEEventPayload) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          )
        } catch {
          // Stream closed, will be cleaned up by cancel
        }
      })

      // Heartbeat every 25s to keep connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // Stream closed
          cleanup()
        }
      }, 25_000)
    },

    cancel() {
      console.log(`[SSE] User ${userId} disconnected from call events`)
      cleanup()
    },
  })

  function cleanup() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  // Handle client disconnect via AbortSignal
  req.signal.addEventListener("abort", () => {
    console.log(`[SSE] User ${userId} aborted connection`)
    cleanup()
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
      // Prevent compression that might buffer the response
      "Content-Encoding": "none",
      // Help Vercel/serverless platforms understand this is long-running
      "Transfer-Encoding": "chunked",
    },
  })
}
