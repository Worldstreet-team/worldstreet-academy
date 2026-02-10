import { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * SSE diagnostic endpoint - Tests if SSE works in this environment.
 * GET /api/calls/events/test
 * 
 * Usage: Open in browser and check if you see "tick: X" messages every second.
 * If the connection drops before 30 seconds, your platform has timeout issues.
 */
export async function GET(req: NextRequest) {
  console.log("[SSE Test] Client connected")

  const encoder = new TextEncoder()
  let tickCount = 0
  let intervalId: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send platform info
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ 
          type: "info", 
          runtime: "nodejs",
          maxDuration: 60,
          message: "SSE test started. You should see tick messages every second for 30 seconds."
        })}\n\n`)
      )

      // Send tick every second for 30 seconds
      intervalId = setInterval(() => {
        tickCount++
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "tick", 
              count: tickCount,
              timestamp: new Date().toISOString() 
            })}\n\n`)
          )

          // Stop after 30 ticks
          if (tickCount >= 30) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: "complete", 
                message: "Test completed successfully! SSE works in this environment." 
              })}\n\n`)
            )
            cleanup()
            controller.close()
          }
        } catch {
          cleanup()
        }
      }, 1000)
    },

    cancel() {
      console.log("[SSE Test] Client disconnected")
      cleanup()
    },
  })

  function cleanup() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  req.signal.addEventListener("abort", () => {
    console.log("[SSE Test] Connection aborted")
    cleanup()
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
      "Transfer-Encoding": "chunked",
    },
  })
}
