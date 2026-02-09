"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { VideoCall } from "./video-call"

type IncomingCallData = {
  callId: string
  callerName: string
  callerAvatar: string | null
  callType: "video" | "audio"
  conversationId: string
}

export function IncomingCallProvider({ children }: { children: React.ReactNode }) {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [showCall, setShowCall] = useState(false)
  const dismissedCallsRef = useRef<Set<string>>(new Set())

  // Poll for incoming calls
  useEffect(() => {
    let active = true

    async function pollCalls() {
      try {
        const res = await fetch("/api/calls/poll")
        if (!res.ok) return

        const data = await res.json()
        if (!active) return

        if (data.incoming && !dismissedCallsRef.current.has(data.incoming.callId)) {
          setIncomingCall(data.incoming)
          setShowCall(true)
        } else if (!data.incoming) {
          // Call was cancelled or expired, dismiss if showing
          if (incomingCall && !data.incoming) {
            setShowCall(false)
            setIncomingCall(null)
          }
        }
      } catch {
        // Silently ignore poll errors
      }
    }

    // Poll every 2 seconds
    const interval = setInterval(pollCalls, 2000)
    pollCalls() // Initial poll

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [incomingCall])

  const handleClose = useCallback(() => {
    if (incomingCall) {
      dismissedCallsRef.current.add(incomingCall.callId)
    }
    setShowCall(false)
    setIncomingCall(null)
  }, [incomingCall])

  const handleCallEnded = useCallback(() => {
    if (incomingCall) {
      dismissedCallsRef.current.add(incomingCall.callId)
    }
    setShowCall(false)
    setIncomingCall(null)
  }, [incomingCall])

  return (
    <>
      {children}

      {/* Incoming call overlay */}
      {incomingCall && (
        <VideoCall
          open={showCall}
          onClose={handleClose}
          callType={incomingCall.callType}
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar || undefined}
          isIncoming
          incomingCallId={incomingCall.callId}
          onCallEnded={handleCallEnded}
        />
      )}
    </>
  )
}
