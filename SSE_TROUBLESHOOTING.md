# SSE Production Troubleshooting Guide

## Testing SSE in Production

1. **Test the diagnostic endpoint**: Visit `https://your-domain.com/api/calls/events/test` in your browser
   - You should see JSON messages appearing every second for 30 seconds
   - If it stops before 30 seconds, you have a timeout issue

2. **Check browser console**: Look for SSE connection errors in the browser console
   - `EventSource failed` = Connection couldn't be established
   - Frequent reconnections = Server is dropping connections

## Common Production Issues & Solutions

### Issue 1: Connections Drop After 10-60 Seconds

**Cause**: Serverless platform timeout limits

**Solutions**:
- **Vercel Hobby Plan**: Has 10s max timeout - SSE won't work reliably
  - ✅ **Upgrade to Vercel Pro** ($20/mo) - supports up to 300s with `maxDuration`
  - ✅ **Use Vercel Edge Network** - But requires Edge-compatible database (not Mongoose)
  - ✅ **Switch to WebSocket service**: Pusher, Ably, or Supabase Realtime

- **Netlify**: 26s max for serverless functions on Pro plan
  - ✅ **Switch to WebSocket service** (recommended)
  
- **Self-hosted/VPS**: Should work fine with Node.js

### Issue 2: Events Not Received

**Cause**: Buffering proxies or CDN caching

**Solutions**:
- **CloudFlare**: Disable "Rocket Loader" and set cache rules to bypass for `/api/calls/events`
- **nginx**: Already handled by `X-Accel-Buffering: no` header
- **Other CDNs**: Add cache bypass rules for SSE endpoints

### Issue 3: CORS Errors

**Cause**: Frontend on different domain than API

**Solution**: Add CORS headers to `/app/api/calls/events/route.ts`:
```typescript
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Content-Encoding": "none",
    "Transfer-Encoding": "chunked",
    "Access-Control-Allow-Origin": "https://your-frontend-domain.com",
    "Access-Control-Allow-Credentials": "true",
  },
})
```

### Issue 4: Connection Limit Exceeded

**Cause**: Serverless platforms limit concurrent connections

**Solution**: 
- Use connection pooling on client side
- Close inactive connections after 5 minutes
- Consider WebSocket service for high-traffic apps

## Recommended Production Architecture

### For Small-Medium Apps (< 1000 concurrent users)
**Option A: Vercel Pro + Node.js Runtime**
- ✅ Current setup works
- ⚠️ Requires Pro plan ($20/mo minimum)
- ⚠️ 300s max connection time (reconnects needed)

**Option B: Self-hosted VPS**
- ✅ No timeout limits
- ✅ Full control
- ⚠️ More maintenance

### For Large Apps (> 1000 concurrent users)
**Recommended: Managed WebSocket Service**

1. **Pusher** (https://pusher.com)
   - Easy integration
   - Free tier: 100 concurrent, 200k messages/day
   - Paid: $49/mo for 500 concurrent

2. **Ably** (https://ably.com)
   - More features
   - Free tier: 6M messages/month
   - Paid: $29/mo

3. **Supabase Realtime** (https://supabase.com)
   - Free tier: 2M Realtime messages/month
   - Integrated with Supabase database
   - Paid: $25/mo

## Migration to Pusher (Example)

```typescript
// Install: pnpm add pusher pusher-js

// Server-side (lib/pusher.ts)
import Pusher from 'pusher'

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

// Emit events
export async function sendCallEvent(userId: string, event: CallEventPayload) {
  await pusher.trigger(`user-${userId}`, 'call-event', event)
}

// Client-side hook (replace use-call-events.ts)
import Pusher from 'pusher-js'

export function useCallEvents(userId: string, onEvent: EventHandler) {
  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })
    
    const channel = pusher.subscribe(`user-${userId}`)
    channel.bind('call-event', onEvent)
    
    return () => {
      channel.unbind('call-event', onEvent)
      pusher.unsubscribe(`user-${userId}`)
    }
  }, [userId, onEvent])
}
```

## Quick Fix: Polling Fallback

If SSE doesn't work at all, implement polling as a fallback:

```typescript
// lib/hooks/use-call-events.ts
export function useCallEvents(userId: string, onEvent: EventHandler) {
  const [usePolling, setUsePolling] = useState(false)
  
  // Try SSE first
  useEffect(() => {
    if (usePolling) return // Use polling instead
    
    const es = new EventSource("/api/calls/events")
    
    es.onerror = (err) => {
      // If SSE fails repeatedly, switch to polling
      if (reconnectAttempts.current > 3) {
        console.warn("[SSE] Failed multiple times, switching to polling")
        setUsePolling(true)
        es.close()
      }
    }
    
    // ... rest of SSE logic
  }, [userId, usePolling])
  
  // Polling fallback
  useEffect(() => {
    if (!usePolling) return
    
    const interval = setInterval(async () => {
      const res = await fetch("/api/calls/poll")
      const events = await res.json()
      events.forEach(onEvent)
    }, 3000) // Poll every 3 seconds
    
    return () => clearInterval(interval)
  }, [usePolling, onEvent])
}
```

## Environment Variables Checklist

For production, ensure these are set:

```bash
# MongoDB (required for Mongoose)
MONGODB_URI=mongodb+srv://...

# JWT (required for auth)
JWT_ACCESS_SECRET=your-secret-key

# Pusher (if using Pusher instead of SSE)
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=...
NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=...
```

## Monitoring SSE Health

Add logging to track SSE health in production:

```typescript
// In /app/api/calls/events/route.ts
console.log(`[SSE] User ${userId} connected at ${new Date().toISOString()}`)
console.log(`[SSE] Active connections: ${getSubscriberCount()}`)

// When events are sent
console.log(`[SSE] Sent ${event.type} to user ${userId}`)
```

Monitor these logs in your deployment platform (Vercel logs, CloudWatch, etc.)

## Decision Tree

```
Is SSE working in development?
├─ No → Check MongoDB connection, check browser console
└─ Yes → Continue

Is production on Vercel?
├─ Yes → Is it Hobby plan?
│   ├─ Yes → Won't work reliably, upgrade to Pro or switch to Pusher
│   └─ No (Pro/Enterprise) → Should work with maxDuration = 300
└─ No → Continue

Does /api/calls/events/test work for 30 seconds?
├─ Yes → SSE works, check event emission logic
└─ No → Platform timeout issue, switch to WebSocket service

Getting CORS errors?
└─ Add Access-Control-Allow-Origin header

Still not working?
└─ Implement Pusher/Ably or polling fallback
```

## Support

If SSE still doesn't work after trying these solutions:
1. Check the diagnostic endpoint `/api/calls/events/test`
2. Share browser console errors
3. Share server logs from your deployment platform
4. Specify which hosting platform you're using (Vercel/Netlify/AWS/etc.)
