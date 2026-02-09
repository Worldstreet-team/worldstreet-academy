import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Skeleton for a single conversation item in the list
 */
export function ConversationItemSkeleton() {
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      {/* Avatar */}
      <Skeleton className="h-11 w-11 rounded-full shrink-0" />
      
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-3 w-[85%]" />
      </div>
    </div>
  )
}

/**
 * Skeleton for the conversation list sidebar
 */
export function ConversationListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col">
      {/* Search bar skeleton */}
      <div className="p-3 border-b">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
      
      {/* Conversation items */}
      <div className="flex-1">
        {Array.from({ length: count }).map((_, i) => (
          <ConversationItemSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for a message bubble
 */
export function MessageBubbleSkeleton({ 
  isOwn = false,
  hasAvatar = true,
  variant = "text"
}: { 
  isOwn?: boolean
  hasAvatar?: boolean
  variant?: "text" | "image" | "audio"
}) {
  return (
    <div className={cn(
      "flex gap-2",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {/* Avatar placeholder (only for received messages) */}
      {!isOwn && hasAvatar && (
        <Skeleton className="h-6 w-6 rounded-full shrink-0 mt-1" />
      )}
      {!isOwn && !hasAvatar && <div className="w-6 shrink-0" />}

      <div className={cn(
        "flex flex-col max-w-[75%]",
        isOwn ? "items-end" : "items-start"
      )}>
        {/* Message bubble */}
        <div className={cn(
          "rounded-2xl px-3 py-2",
          isOwn 
            ? "bg-primary/20 rounded-br-md" 
            : "bg-muted/60 rounded-bl-md"
        )}>
          {variant === "text" && (
            <div className="space-y-1">
              <Skeleton className={cn(
                "h-3",
                isOwn ? "w-32 bg-primary/30" : "w-36"
              )} />
              <Skeleton className={cn(
                "h-3",
                isOwn ? "w-20 bg-primary/30" : "w-24"
              )} />
            </div>
          )}
          
          {variant === "image" && (
            <Skeleton className="h-40 w-48 rounded-xl" />
          )}
          
          {variant === "audio" && (
            <div className="flex items-center gap-2 min-w-44">
              <Skeleton className={cn(
                "h-8 w-8 rounded-full",
                isOwn ? "bg-primary/30" : ""
              )} />
              <div className="flex-1 flex items-center gap-[2px] h-5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <Skeleton 
                    key={i} 
                    className={cn(
                      "w-[2px] rounded-full",
                      isOwn ? "bg-primary/30" : ""
                    )}
                    style={{ height: `${Math.random() * 12 + 4}px` }}
                  />
                ))}
              </div>
              <Skeleton className={cn(
                "h-3 w-8",
                isOwn ? "bg-primary/30" : ""
              )} />
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <Skeleton className="h-2.5 w-10 mt-0.5 mx-0.5" />
      </div>
    </div>
  )
}

/**
 * Skeleton for the messages area (chat view)
 */
export function MessagesAreaSkeleton() {
  // Generate varied message patterns
  const messagePatterns = [
    { isOwn: false, variant: "text" as const, hasAvatar: true },
    { isOwn: false, variant: "text" as const, hasAvatar: false },
    { isOwn: true, variant: "text" as const, hasAvatar: false },
    { isOwn: true, variant: "text" as const, hasAvatar: false },
    { isOwn: false, variant: "audio" as const, hasAvatar: true },
    { isOwn: true, variant: "text" as const, hasAvatar: false },
    { isOwn: false, variant: "text" as const, hasAvatar: true },
    { isOwn: true, variant: "image" as const, hasAvatar: false },
    { isOwn: false, variant: "text" as const, hasAvatar: true },
  ]

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat header skeleton */}
      <div className="h-14 border-b flex items-center px-3 gap-3">
        <Skeleton className="h-8 w-8 rounded-full md:hidden" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Messages area skeleton */}
      <div className="flex-1 px-3 py-4 space-y-2 max-w-3xl mx-auto w-full">
        {/* Date separator */}
        <div className="flex items-center justify-center py-2">
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        
        {/* Message bubbles */}
        <div className="space-y-2">
          {messagePatterns.map((pattern, i) => (
            <MessageBubbleSkeleton key={i} {...pattern} />
          ))}
        </div>
      </div>

      {/* Input skeleton */}
      <div className="border-t px-3 py-2.5">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <Skeleton className="h-10 flex-1 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        </div>
      </div>
    </div>
  )
}

/**
 * Full messages page skeleton combining list and chat area
 */
export function MessagesPageSkeleton() {
  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Conversation list skeleton */}
      <div className="w-full md:w-80 lg:w-96 border-r bg-background">
        <div className="p-3 border-b flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <ConversationListSkeleton count={8} />
      </div>

      {/* Chat area skeleton - hidden on mobile */}
      <div className="hidden md:flex flex-1 flex-col bg-muted/10">
        <MessagesAreaSkeleton />
      </div>
    </div>
  )
}
