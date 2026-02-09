# Cloudflare RealtimeKit (Dyte SDK) Implementation Guide

## Overview

This document captures the complete implementation of audio/video calling using Cloudflare RealtimeKit (powered by Dyte SDK) in a Next.js application. The implementation overcomes several critical challenges related to React lifecycle, WebSocket stability, and real-time event handling.

---

## Architecture

### Core Components

1. **Singleton RTK Client** (`lib/rtk-client.ts`)
   - Module-level client manager completely decoupled from React lifecycle
   - Survives re-renders, HMR/Fast Refresh, and React strict mode
   - Manages WebSocket connection persistence

2. **VideoCall Component** (`components/messages/video-call.tsx`)
   - Full-featured call UI with ringing/connecting/connected/ended states
   - Handles both incoming and outgoing calls
   - Video/audio controls, minimize/maximize, call timer

3. **CallProvider** (`components/providers/call-provider.tsx`)
   - Global call state management
   - Incoming call polling via server actions
   - Renders VideoCall as modal overlay

4. **Server Actions** (`lib/actions/calls.ts`)
   - Call CRUD operations via MongoDB
   - Dyte REST API integration for meeting/participant management
   - Polling endpoints for call status and incoming calls

---

## Key Learnings & Solutions

### 1. React Lifecycle vs WebSocket Connections

**Problem**: The official `useRealtimeKitClient()` React hook manages the Dyte client as React state. Any re-render (message polling, state transitions, HMR) destroys and recreates the WebSocket connection mid-call, causing:
- `WebSocket is closed before the connection is established`
- Premature disconnections during initial handshake
- Audio/video streams lost on component re-render

**Solution**: **Module-level singleton pattern**

```typescript
// lib/rtk-client.ts
let _client: RTKClientInstance | null = null
let _isInRoom = false

export const rtkClient = {
  async init(authToken, defaults) {
    const { default: ClientClass } = await import("@cloudflare/realtimekit")
    _client = await ClientClass.init({ authToken, defaults })
    return _client
  },
  
  async joinRoom() {
    if (!_client || _isInRoom) return
    await _client.joinRoom()
    _isInRoom = true
  },
  
  async leaveRoom() { /* ... */ },
  
  on(event, target, callback) {
    // Store listeners and re-attach after client re-init
  }
}
```

**Benefits**:
- WebSocket connection persists across React re-renders
- Event listeners survive component unmount/remount
- HMR doesn't kill active calls
- Works with React strict mode (development double-mounting)

---

### 2. Phantom `participantLeft` Events

**Problem**: Dyte SDK fires a rapid sequence during initial connection:
```
[RTK] Participant joined: User A
[RTK] Participant left          ← PHANTOM EVENT
[RTK] Participant joined: User A
[RTK] Room joined
```

The old handler immediately ended the call on the first `participantLeft`, creating:
- 0-second "completed" call records in the database
- Call UI stuck in "ended" state with `isEndingRef.current = true`
- "End Call" button permanently disabled (early return on `if (isEndingRef.current)`)

**Solution**: **Debounced `participantLeft` with 3-second delay + reconnection detection**

```typescript
const handleParticipantLeft = () => {
  console.log("[RTK] Participant left")
  
  // Cancel previous timer if exists
  if (participantLeftTimerRef.current) {
    clearTimeout(participantLeftTimerRef.current)
  }
  
  // Wait 3 seconds to confirm participant really left
  participantLeftTimerRef.current = setTimeout(() => {
    // Check if participant rejoined during wait
    if (remoteParticipantRef.current) {
      console.log("[RTK] Participant is back, ignoring")
      return
    }
    
    // Only end if we were actually connected
    if (!isConnectedRef.current) {
      console.log("[RTK] Participant left during setup, ignoring")
      return
    }
    
    // Confirmed real disconnection
    if (!isEndingRef.current) {
      isEndingRef.current = true
      endCallAction(callId).catch(console.error)
      setCallState("ended")
    }
  }, 3000)
  
  remoteParticipantRef.current = null
}

const handleParticipantJoined = (participant) => {
  // Cancel debounce timer if exists
  if (participantLeftTimerRef.current) {
    clearTimeout(participantLeftTimerRef.current)
    participantLeftTimerRef.current = null
  }
  
  remoteParticipantRef.current = participant
  isConnectedRef.current = true
  isEndingRef.current = false  // Reset so end button works
  setCallState("connected")
}
```

**Key insights**:
- Phantom events happen BEFORE `isConnectedRef` is set
- Real disconnections happen AFTER connection is established
- 3-second window is sufficient to detect phantom events vs real ones
- `participantJoined` must reset `isEndingRef` to unblock end button

---

### 3. Audio Not Transmitting

**Problem**: RTK client initialized with `defaults: { audio: true }`, but microphone wasn't actually publishing after `joinRoom()`.

**Solution**: **Explicit audio/video enablement after room join**

```typescript
await rtkClient.joinRoom()

// Explicitly enable audio after join
await rtkClient.client?.self.enableAudio()

// For video calls, also enable video
if (callType === "video") {
  await rtkClient.client?.self.enableVideo()
}
```

Also added in the `roomJoined` event handler as belt-and-suspenders:

```typescript
const handleRoomJoined = () => {
  console.log("[RTK] Room joined")
  
  // Register video elements
  if (localVideoRef.current && callType === "video") {
    rtkClient.client?.self.registerVideoElement(localVideoRef.current, true)
  }
  
  // Explicitly enable audio/video
  rtkClient.client?.self.enableAudio().catch(() => {})
  if (callType === "video") {
    rtkClient.client?.self.enableVideo().catch(() => {})
  }
}
```

**Why this was needed**: The `defaults` option tells the SDK what permissions to request, but doesn't guarantee the tracks are actively publishing. Explicit `enable*()` calls ensure the media streams start flowing.

---

### 4. React Strict Mode Issues

**Problem**: Next.js 16 enables React strict mode by default in development, which runs all effects twice:
```
Mount → Cleanup → Remount
```

The `useRealtimeKitClient` hook's cleanup destroys the RTK connection on the first unmount, before the second mount re-establishes it.

**Solution**: **Disabled React strict mode for development** + **singleton pattern**

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  reactStrictMode: false,  // Disable double-mount in dev
  // ...
}
```

Combined with the singleton pattern, this ensures:
- No double-initialization during development
- WebSocket connections aren't destroyed by React's internal testing mechanism
- Production builds can still use strict mode if needed (set via environment variable)

**Alternative**: Keep strict mode enabled and make the singleton even more robust with initialization guards, but disabling it for a WebSocket-heavy feature is pragmatic.

---

### 5. Stale Call IDs (Race Condition)

**Problem**: When caller retests quickly, old "ringing" calls linger in the database. Receiver polls, finds the old call, answers it. But caller created a NEW call that nobody answers. Result: both sides stuck in different calls.

**Solution**: **Expire all previous ringing calls between a pair before creating a new one**

```typescript
// In initiateCall() - lib/actions/calls.ts
await Call.updateMany(
  {
    status: "ringing",
    $or: [
      { callerId, receiverId: recipientId },
      { callerId: recipientId, receiverId: callerId },
    ],
  },
  { status: "missed", endedAt: new Date() }
)

// Then create the new call
const call = await Call.create({
  conversationId,
  callerId,
  receiverId: recipientId,
  type,
  status: "ringing",
  meetingId,
  callerToken,
  receiverToken,
})
```

**Why bidirectional**: Covers cases where A calls B, B declines, then B immediately calls A. The old A→B call should be expired before creating the new B→A call.

---

### 6. Server Polling vs WebSockets

**Decision**: Used **polling with server actions** instead of WebSockets for signaling.

**Rationale**:
- The actual media streams use WebRTC (via Dyte's infrastructure)
- Signaling only needs:
  - Caller polls call status every 1s to detect when receiver answers
  - Receiver polls for incoming calls every 1.5s
  - Active call status poll every 2s (fallback to detect remote hangup)
- Next.js server actions are simpler than managing WebSocket server state
- Cloudflare Workers (if deploying there) make WebSockets more complex

**Trade-off**: Slightly higher latency (1-1.5s) before call rings on receiver's device. Acceptable for this use case.

**Future optimization**: Consider using Server-Sent Events (SSE) or WebSockets if sub-second latency is required.

---

## Critical Configuration

### Environment Variables

```env
# Cloudflare RealtimeKit (Dyte Infrastructure)
CLOUDFLARE_REALTIME_ORG_ID=aee53809-a5b3-4494-9abc-9b9646499461
CLOUDFLARE_REALTIME_API_KEY=af45449f301a6908e764
```

These are used server-side to:
1. Create meetings via Dyte REST API (`https://api.dyte.io/v2`)
2. Generate participant auth tokens with Basic Auth (`OrgId:ApiKey`)

### Meeting Configuration

```typescript
// lib/realtime.ts
await fetch("https://api.dyte.io/v2/meetings", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${btoa(`${ORG_ID}:${API_KEY}`)}`,
  },
  body: JSON.stringify({ 
    title: "Call Name",
    live: true,  // Critical: keeps meeting active during setup
  }),
})
```

**Key detail**: `live: true` prevents the meeting from auto-closing when participants are joining but haven't fully connected yet.

---

## Call Flow Sequence Diagrams

### Outgoing Call (Caller Side)

```
User clicks "Call" button
    ↓
initiateCall(receiverId, type) [Server Action]
    ↓
Create Dyte meeting + participants
    ↓
Save Call record (status: "ringing") to MongoDB
    ↓
Return { callId, authToken } to client
    ↓
Store authToken in ref, set UI to "ringing"
    ↓
Poll getCallStatus(callId) every 1s
    ↓
Status = "ongoing"? (Receiver answered)
    ↓
rtkClient.init(authToken, { audio: true, video: isVideo })
    ↓
rtkClient.joinRoom()
    ↓
rtkClient.client.self.enableAudio()
    ↓
Wait for "participantJoined" event
    ↓
Set UI to "connected", start call timer
```

### Incoming Call (Receiver Side)

```
pollIncomingCall() runs every 1.5s [Server Action]
    ↓
Find newest ringing call where receiverId = currentUser
    ↓
Show incoming call UI
    ↓
User clicks "Answer"
    ↓
answerCall(callId) [Server Action]
    ↓
Update Call status to "ongoing" in MongoDB
    ↓
Return { authToken } to client
    ↓
rtkClient.init(authToken, { audio: true, video: isVideo })
    ↓
rtkClient.joinRoom()
    ↓
rtkClient.client.self.enableAudio()
    ↓
Wait for "participantJoined" event
    ↓
Set UI to "connected", start call timer
```

### Call Teardown

```
User clicks "End Call" OR participantLeft event (debounced 3s)
    ↓
handleEndCall()
    ↓
endCallAction(callId) [Server Action]
    - Calculate duration
    - Set status to "completed"
    - Insert system message in conversation
    ↓
rtkClient.leaveRoom()
    ↓
Set UI to "ended"
    ↓
After 2s delay: close call UI
```

---

## Database Schema

```typescript
// Call Model
{
  _id: ObjectId,
  conversationId: ObjectId,  // Reference to conversation
  callerId: ObjectId,        // User who initiated
  receiverId: ObjectId,      // User who received
  type: "video" | "audio",
  status: "ringing" | "ongoing" | "completed" | "missed" | "declined" | "failed",
  meetingId: string,         // Dyte meeting ID
  callerToken: string,       // JWT auth token for caller
  receiverToken: string,     // JWT auth token for receiver
  answeredAt: Date?,
  endedAt: Date?,
  duration: number,          // In seconds
  createdAt: Date,
  updatedAt: Date
}
```

**Status transitions**:
- `ringing` → `ongoing` (when receiver answers)
- `ringing` → `missed` (when caller ends before answer, or >30s timeout)
- `ringing` → `declined` (when receiver declines)
- `ongoing` → `completed` (when either party ends after connection)
- `ongoing` → `failed` (on unexpected errors)

---

## Performance Optimizations

### 1. Module-level Event Listener Storage

```typescript
const _listeners: Array<{
  event: string
  target: "self" | "participants"
  callback: RTKEventCallback
}> = []

export const rtkClient = {
  on(event, target, callback) {
    _listeners.push({ event, target, callback })
    if (_client) {
      _attachListener(event, target, callback)
    }
  },
  
  async init(authToken, defaults) {
    // ... init client
    
    // Re-attach all registered listeners
    for (const { event, target, callback } of _listeners) {
      _attachListener(event, target, callback)
    }
  }
}
```

**Benefit**: When the client is re-initialized (e.g., starting a new call), all previously registered event listeners are automatically re-attached without the component needing to re-register them.

### 2. Guard Clauses for Double-Init Prevention

```typescript
async init(authToken, defaults) {
  // Prevent double-init during rapid re-renders
  if (_isInitializing) {
    console.log("[RTK-Client] Init already in progress, waiting...")
    while (_isInitializing) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (_client) return _client
  }
  
  _isInitializing = true
  try {
    // ... actual init
  } finally {
    _isInitializing = false
  }
}
```

**Benefit**: If multiple components try to initialize the RTK client simultaneously (unlikely but possible with async React), only one initialization proceeds, others wait and reuse the result.

### 3. Separation of Concerns: Destroy Previous Client

```typescript
async init(authToken, defaults) {
  // Dispose existing client first
  if (_client) {
    console.log("[RTK-Client] Destroying previous client before re-init")
    await this.destroy()
  }
  
  // Then create new one
  _client = await ClientClass.init({ authToken, defaults })
}
```

**Benefit**: Ensures clean state when starting a new call. The old RTK connection is fully torn down before establishing a new one.

---

## Error Handling Patterns

### 1. Separate Try-Catch for Independent Operations

```typescript
const handleEndCall = async () => {
  if (isEndingRef.current) return
  isEndingRef.current = true
  
  // End on server (don't let failure block room leave)
  if (callId) {
    try { 
      await endCallAction(callId) 
    } catch (e) { 
      console.error("End call server error:", e) 
    }
  }
  
  // Leave RTK room (separate try-catch)
  try { 
    await rtkClient.leaveRoom() 
  } catch (e) { 
    console.error("Leave room error:", e) 
  }
  
  setCallState("ended")
}
```

**Rationale**: If `endCallAction` fails (network error, server down), we still want to leave the RTK room locally. If one operation fails, the other should still proceed.

### 2. Failed Answer Handling

```typescript
const handleAnswer = async () => {
  const result = await answerCall(incomingCallId)
  
  if (result.success && result.authToken) {
    // Normal flow: init RTK, join room
    try {
      await rtkClient.init(result.authToken, { audio: true, video: isVideo })
      await rtkClient.joinRoom()
      await rtkClient.client?.self.enableAudio()
    } catch (err) {
      console.error("[Receiver] RTK init/join failed:", err)
      setCallState("ended")
    }
  } else {
    // Call was already expired/answered by someone else
    console.error("[Receiver] Answer failed:", result.error)
    onCallEnded?.()  // Dismiss immediately, don't show "ended" for 2s
    onClose()        // Let receiver see the next incoming call
  }
}
```

**Key detail**: If `answerCall` fails (call was expired, answered elsewhere, or declined), we immediately close the UI instead of showing "ended" state. This lets the receiver's polling find the NEXT valid incoming call quickly.

---

## Testing Considerations

### Manual Testing Checklist

- [ ] **Basic video call**: Both sides see video, hear audio
- [ ] **Basic audio call**: Both sides hear audio
- [ ] **Call declining**: Receiver declines, caller sees "Call declined"
- [ ] **Call timeout**: Caller cancels before receiver answers
- [ ] **Mid-call end**: Either party can end the call
- [ ] **Network drop simulation**: Disconnect WiFi mid-call, verify cleanup
- [ ] **Rapid re-dial**: Call → End → Call again quickly, no stale calls
- [ ] **Minimize/maximize**: Call UI can be minimized, still shows timer
- [ ] **Mute/unmute**: Toggle works during call
- [ ] **Video on/off**: Toggle works during video call
- [ ] **Browser refresh**: Caller refreshes mid-call, call ends gracefully
- [ ] **Message polling interference**: Send messages during call, no disconnection

### Known Limitations

1. **No call queue**: If multiple users call the same receiver simultaneously, only the newest call is shown. Earlier calls are automatically missed.

2. **No call transfer**: Once connected, can't transfer to another user.

3. **No group calls**: Current implementation is 1-to-1 only. Dyte supports group, but our UI and logic assume two participants.

4. **Browser permission prompts**: First call requires microphone/camera permission. If user denies, call fails silently. Should add better error UI.

---

## Deployment Notes

### Production Checklist

- [ ] **Enable React strict mode conditionally**:
  ```typescript
  const nextConfig: NextConfig = {
    reactStrictMode: process.env.NODE_ENV === "production",
  }
  ```

- [ ] **Rate limit polling endpoints**: 
  - `pollIncomingCall`: Max 1 request per second per user
  - `getCallStatus`: Max 2 requests per second per call

- [ ] **Cloudflare Realtime billing**: Monitor usage
  - Each meeting consumes minutes
  - Set up billing alerts

- [ ] **Cleanup stale calls**: Cron job to expire `ringing` calls >5 minutes old
  ```typescript
  // Run every minute
  await Call.updateMany(
    { status: "ringing", createdAt: { $lt: new Date(Date.now() - 300_000) } },
    { status: "missed", endedAt: new Date() }
  )
  ```

- [ ] **Monitor RTK errors**: Set up error tracking for:
  - `[RTK-Client] Init failed`
  - `RTK joinRoom error`
  - `An unexpected response was received from the server`

- [ ] **Implement reconnection logic**: If `roomLeft` fires unexpectedly, attempt to rejoin (not currently implemented)

---

## Troubleshooting Guide

### Issue: "WebSocket is closed before the connection is established"

**Cause**: Component re-rendering mid-connection, destroying the WebSocket.

**Fix**: Ensure using the singleton `rtkClient`, not the React hook.

---

### Issue: Call shows "Connected" but no audio

**Symptoms**: Both sides see call timer, but can't hear each other.

**Causes**:
1. Browser didn't grant microphone permission
2. Audio not explicitly enabled after `joinRoom()`
3. Dyte preset doesn't allow audio publishing

**Debugging**:
```typescript
// Check in browser console during call
rtkClient.client?.self.audioEnabled  // Should be true
rtkClient.client?.self.audioTrack    // Should be MediaStreamTrack
```

**Fix**: Ensure `enableAudio()` is called after `joinRoom()`.

---

### Issue: Call ends immediately after connecting (0-second call)

**Cause**: Phantom `participantLeft` event during initial connection.

**Fix**: Verify the 3-second debounce is in place and `isConnectedRef` is being set.

---

### Issue: "End Call" button doesn't work

**Cause**: `isEndingRef.current` stuck at `true` from phantom `participantLeft`.

**Fix**: Ensure `participantJoined` resets `isEndingRef = false`.

---

### Issue: Receiver answers, but caller still shows "Calling..."

**Cause**: Stale call ID — receiver answered an old call, caller's poll is checking a different call.

**Solution**: Implemented in `initiateCall()` — old calls are expired before creating new one.

---

## Session 2 Fixes (Feb 2026)

### 7. Remote Audio Not Playing

**Problem**: Users could see remote video but couldn't hear each other. For audio-only calls, no media was played at all.

**Root Cause**: The Dyte/RTK SDK's `registerVideoElement()` only handles the video track. Remote audio was never explicitly played — the code relied on the SDK to auto-manage audio, but with Cloudflare RealtimeKit that auto-management doesn't work reliably.

**Solution**: **Explicit remote audio handling via hidden `<audio>` element**

```typescript
// Hidden audio element in render
<audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

// In handleParticipantJoined:
if (participant.audioTrack) {
  const stream = new MediaStream([participant.audioTrack])
  remoteAudioRef.current.srcObject = stream
  remoteAudioRef.current.play().catch(console.warn)
}

// Listen for audio track changes via audioUpdate event
rtkClient.on("audioUpdate", "participants", (participant, { audioEnabled, audioTrack }) => {
  setIsRemoteMuted(!audioEnabled)
  if (audioEnabled && audioTrack) {
    const stream = new MediaStream([audioTrack])
    remoteAudioRef.current.srcObject = stream
    remoteAudioRef.current.play().catch(() => {})
  }
})
```

**Also**: Resume `AudioContext` during user gesture (click Answer/Call) to satisfy browser autoplay policies.

---

### 8. Duplicate Call System Messages

**Problem**: Multiple "call ended" messages appeared in chat for a single call. Both participants could trigger `endCall()` simultaneously (one via button click, other via `participantLeft` event), each inserting a system message.

**Solution**: **Atomic `findOneAndUpdate` with terminal-state guard**

```typescript
// Guard: skip if already terminal
if (["completed", "missed", "declined", "failed"].includes(call.status)) {
  return { success: true }  // Already ended, no-op
}

// Atomic update: only ONE participant wins the race
const updated = await Call.findOneAndUpdate(
  { _id: callId, status: { $nin: ["completed", "missed", "declined", "failed"] } },
  { status: newStatus, endedAt: endTime, duration },
  { new: true }
)

// Only the winner inserts the system message
if (updated) await insertCallSystemMessage(updated)
```

Same pattern applied to `expireRingingCalls()` — uses `findOneAndUpdate` with `{ status: "ringing" }` filter.

---

### 9. Minimized Call Showing Accept UI on Restore

**Problem**: When minimizing a connected call and restoring it, the UI reset to "ringing" state showing Accept/Decline buttons even though the call was ongoing.

**Root Cause**: The reset effect had `externalMinimized` as a dependency. When `externalMinimized` toggled, it re-fired the effect which reset `callState` to the initial value.

**Solution**: **Guard against resetting active calls**

```typescript
useEffect(() => {
  if (open) {
    // Skip reset if already in an active call (restoring from minimize)
    if (hasJoinedRoomRef.current || isConnectedRef.current) return

    setCallState(isIncoming ? "ringing" : "connecting")
    // ... rest of reset
  }
}, [open, isIncoming, callType, externalMinimized])
```

---

### 10. Call Sounds

**Implementation**: Synthesized tones via Web Audio API (`lib/call-sounds.ts`) — no external sound files needed.

| Event | Sound | Pattern |
|---|---|---|
| Outgoing ring | 440+480 Hz dual tone | 2s on / 4s off, repeating |
| Incoming ring | C5→E5 chirps | Double-chirp every 2.5s |
| Connected | C5→E5→G5 arpeggio | Single ascending chord |
| Ended | B4→G4→E4 | Single descending tone |
| Declined | 480 Hz beep-beep | Two short low beeps |

`AudioContext` is resumed during user gesture (click) to satisfy autoplay policies.

---

### 11. Mute Indicator

**Implementation**: Track remote participant's mute state via `audioUpdate` event on `participants.joined`. Display in UI:

- **Video calls**: "Muted" pill overlay on remote video (top-left)
- **Audio calls**: Red "Muted" text next to call timer
- **Minimized PIP**: Visible in compact view

---

### 12. Ringing UI Feedback

**Problem**: Ringing state was set correctly but lacked visual/audio feedback, making it feel unresponsive.

**Solution**:
- Changed "Calling..." to "Ringing..." for outgoing calls
- Added pulsing dot animation during ringing state
- Added sound effects (outgoing dial tone / incoming ring)

---

## Future Enhancements

### 1. Screen Sharing

Dyte supports screen sharing:

```typescript
await rtkClient.client?.self.enableScreenShare()
```

Would need UI buttons and screen share video element registration.

### 2. Call History UI

Currently call records are in MongoDB but not displayed. Could add:
- Recent calls list in messages page
- "Call back" button next to missed calls
- Call duration/status badges

### 3. Push Notifications for Incoming Calls

Use Firebase Cloud Messaging or Apple Push Notification Service to wake the app when a call comes in (mobile web or PWA).

### 4. Network Quality Indicator

Dyte provides connection quality metrics:

```typescript
rtkClient.client?.self.networkQuality  // "good" | "fair" | "poor"
```

Show a visual indicator in the call UI.

### 5. Call Recording

Dyte supports recording:

```typescript
await rtkClient.client?.recording.start()
```

Would need permission handling and storage for recordings.

---

## Key Takeaways

1. **Decouple real-time state from React state**: WebSocket connections should live outside React's lifecycle.

2. **Debounce is essential for real-time events**: SDKs often fire rapid sequences of events during state transitions.

3. **Event timing matters**: The order of `participantJoined → participantLeft → participantJoined` reveals phantom events vs real disconnections.

4. **Explicit is better than implicit**: Don't rely on `defaults` to enable media — explicitly call `enableAudio()`/`enableVideo()`.

5. **Graceful degradation**: Separate try-catches let operations fail independently without cascading failures.

6. **Polling is good enough**: For a 1-to-1 calling feature, 1-2 second polling latency is acceptable. WebSockets add complexity without meaningful UX improvement.

---

## References

- [Cloudflare RealtimeKit Docs](https://developers.cloudflare.com/realtime-api/)
- [Dyte API Reference](https://docs.dyte.io/api/) (Underlying SDK)
- [Dyte React SDK](https://www.npmjs.com/package/@dytesdk/react-web-core)
- [Cloudflare RealtimeKit React](https://www.npmjs.com/package/@cloudflare/realtimekit-react)

---

## License & Credits

Implementation by GitHub Copilot (Claude Sonnet 4.5) for Worldstreet Academy.

This document is provided as-is for educational purposes.
