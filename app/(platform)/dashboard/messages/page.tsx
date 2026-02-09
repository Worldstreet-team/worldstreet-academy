"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Message01Icon, UserAdd01Icon, Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import {
  ConversationList,
  ChatHeader,
  MessageBubble,
  MessageInput,
  DateSeparator,
  groupMessagesByDate,
  VideoCall,
  type Conversation,
  type MessageType,
  type Attachment,
} from "@/components/messages"
import {
  getConversations,
  getMessages,
  sendMessage,
  searchUsers,
  getOrCreateConversation,
  getRecentUsers,
  type ConversationWithDetails,
  type MessageWithDetails,
  type UserSearchResult,
} from "@/lib/actions/messages"
import { getImageUploadUrl, getVideoUploadUrl, getAudioUploadUrl } from "@/lib/actions/upload"
import { useMessagePolling } from "@/lib/hooks/use-websocket"
import { ConversationListSkeleton, MessagesAreaSkeleton } from "@/components/skeletons/message-skeletons"

// Extended message type with status for optimistic updates
type OptimisticMessage = MessageWithDetails & { status?: "pending" | "sent" | "error"; uploadProgress?: number }

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [messages, setMessages] = useState<OptimisticMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedParticipant, setSelectedParticipant] = useState<ConversationWithDetails["participant"] | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [activeCall, setActiveCall] = useState<{ type: "video" | "audio" } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  
  // User search state
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [recentUsers, setRecentUsers] = useState<UserSearchResult[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversations
  useEffect(() => {
    async function loadConversations() {
      setIsLoading(true)
      const result = await getConversations()
      if (result.success && result.conversations) {
        setConversations(result.conversations)
      }
      setIsLoading(false)
    }
    loadConversations()
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    async function loadMessages() {
      if (!selectedId) {
        setMessages([])
        return
      }
      setIsLoadingMessages(true)
      const result = await getMessages(selectedId)
      if (result.success && result.messages) {
        setMessages(result.messages)
      }
      setIsLoadingMessages(false)
    }
    loadMessages()
  }, [selectedId])

  // Real-time message polling
  const lastMessageIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    if (messages.length > 0) {
      lastMessageIdRef.current = messages[messages.length - 1].id
    }
  }, [messages])

  useMessagePolling({
    conversationId: selectedId,
    enabled: !!selectedId,
    interval: 3000,
    onNewMessages: useCallback((newMessages: MessageWithDetails[]) => {
      setMessages((prev) => {
        // Filter out messages we already have
        const existingIds = new Set(prev.map((m) => m.id))
        const uniqueNew = newMessages
          .filter((m) => !existingIds.has(m.id))
          .map((m) => ({ ...m, isNew: true }))
        return [...prev, ...uniqueNew]
      })
      // Refresh conversations to update unread counts
      getConversations().then((result) => {
        if (result.success && result.conversations) {
          setConversations(result.conversations)
        }
      })
    }, []),
  })

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" })
    }
  }, [messages])

  // Map to ConversationList format
  const mappedConversations: Conversation[] = conversations.map((c) => ({
    id: c.id,
    name: c.participant.name,
    avatar: c.participant.avatar || undefined,
    lastMessage: c.lastMessage,
    lastMessageType: c.lastMessageType,
    isOwnLastMessage: c.isOwnLastMessage,
    timestamp: new Date(c.lastMessageAt),
    unread: c.unreadCount,
    isOnline: c.participant.isOnline,
  }))

  // Map to MessageType format
  const mappedMessages: MessageType[] = messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar || undefined,
    content: m.content,
    timestamp: new Date(m.timestamp),
    isOwn: m.isOwn,
    isRead: m.isRead,
    isDelivered: m.isDelivered,
    type: m.type === "text" ? undefined : m.type,
    fileUrl: m.fileUrl,
    fileName: m.fileName,
    fileSize: m.fileSize,
    duration: m.duration,
    waveform: m.waveform,
    status: m.status,
    uploadProgress: (m as OptimisticMessage).uploadProgress,
    isNew: (m as OptimisticMessage & { isNew?: boolean }).isNew,
  }))

  const messageGroups = groupMessagesByDate(mappedMessages)

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    const conv = conversations.find((c) => c.id === id)
    setSelectedParticipant(conv?.participant || null)
    setShowMobileChat(true)
  }, [conversations])

  const handleSendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    if (!selectedParticipant) return

    // Generate a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    
    let fileData: { url: string; name?: string; size?: string; duration?: string; waveform?: number[] } | undefined
    let messageType: "text" | "image" | "video" | "audio" | "file" = "text"
    let previewUrl: string | undefined

    if (attachments && attachments.length > 0) {
      const attachment = attachments[0]
      
      // Determine message type
      if (attachment.type === "image") messageType = "image"
      else if (attachment.type === "video") messageType = "video"
      else if (attachment.type === "audio") messageType = "audio"
      else messageType = "file"
      
      // Create preview URL for optimistic display
      previewUrl = attachment.preview
    }

    // Create optimistic message immediately
    const optimisticMessage: OptimisticMessage = {
      id: tempId,
      senderId: selectedParticipant.id, // Will be ignored since isOwn = true
      senderName: "You",
      senderAvatar: null,
      content: content || "",
      type: messageType,
      fileUrl: previewUrl,
      fileName: attachments?.[0]?.file.name,
      fileSize: attachments?.[0]?.file ? `${(attachments[0].file.size / 1024 / 1024).toFixed(2)} MB` : undefined,
      duration: attachments?.[0]?.duration,
      waveform: attachments?.[0]?.waveform,
      isOwn: true,
      isRead: false,
      isDelivered: false,
      timestamp: new Date(),
      status: "pending",
    }

    // Add optimistic message to UI immediately
    setMessages((prev) => [...prev, optimisticMessage])

    try {
      // Process attachment upload if needed
      if (attachments && attachments.length > 0) {
        const attachment = attachments[0]
        const contentType = attachment.file.type || "application/octet-stream"
        let uploadUrlResult
        
        if (messageType === "image") {
          uploadUrlResult = await getImageUploadUrl(attachment.file.name, contentType)
        } else if (messageType === "video") {
          uploadUrlResult = await getVideoUploadUrl(attachment.file.name, contentType)
        } else if (messageType === "audio") {
          uploadUrlResult = await getAudioUploadUrl(attachment.file.name, contentType)
        } else {
          uploadUrlResult = await getImageUploadUrl(attachment.file.name, contentType)
        }
        
        if (uploadUrlResult.success && uploadUrlResult.uploadUrl && uploadUrlResult.publicUrl) {
          // Use XMLHttpRequest for progress tracking on video uploads
          const uploadOk = await new Promise<boolean>((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.open("PUT", uploadUrlResult.uploadUrl!)
            xhr.setRequestHeader("Content-Type", contentType)
            
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const pct = Math.round((event.loaded / event.total) * 100)
                // Update optimistic message with upload progress
                setMessages((prev) => 
                  prev.map((m) => m.id === tempId ? { ...m, uploadProgress: pct } : m)
                )
              }
            }
            
            xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
            xhr.onerror = () => resolve(false)
            xhr.send(attachment.file)
          })
          
          if (uploadOk) {
            fileData = {
              url: uploadUrlResult.publicUrl,
              name: attachment.file.name,
              size: `${(attachment.file.size / 1024 / 1024).toFixed(2)} MB`,
              duration: attachment.duration,
              waveform: attachment.waveform,
            }
          } else {
            throw new Error("Upload failed")
          }
        } else {
          throw new Error("Failed to get upload URL")
        }
      }

      // Send message to server
      const result = await sendMessage(
        selectedParticipant.id,
        content || (fileData ? "" : ""),
        messageType,
        fileData
      )
      
      if (result.success && result.message) {
        // Replace optimistic message with real one
        setMessages((prev) => 
          prev.map((m) => m.id === tempId ? { ...result.message!, status: "sent" as const } : m)
        )
        
        // Refresh conversations to update last message
        const convResult = await getConversations()
        if (convResult.success && convResult.conversations) {
          setConversations(convResult.conversations)
        }
      } else {
        throw new Error(result.error || "Failed to send message")
      }
    } catch (error) {
      console.error("Error sending message:", error)
      // Mark message as failed
      setMessages((prev) => 
        prev.map((m) => m.id === tempId ? { ...m, status: "error" as const } : m)
      )
    }
  }, [selectedParticipant])

  // Load recent users when search modal opens
  useEffect(() => {
    if (showUserSearch && recentUsers.length === 0) {
      setIsLoadingRecent(true)
      getRecentUsers().then((result) => {
        if (result.success && result.users) {
          setRecentUsers(result.users)
        }
        setIsLoadingRecent(false)
      })
    }
  }, [showUserSearch, recentUsers.length])

  // User search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    
    setIsSearching(true)
    const result = await searchUsers(query)
    if (result.success && result.users) {
      setSearchResults(result.users)
    }
    setIsSearching(false)
  }, [])

  const handleStartConversation = useCallback(async (user: UserSearchResult) => {
    const result = await getOrCreateConversation(user.id)
    if (result.success && result.conversationId) {
      setShowUserSearch(false)
      setSearchQuery("")
      setSearchResults([])
      
      // Refresh conversations and select the new one
      const convResult = await getConversations()
      if (convResult.success && convResult.conversations) {
        setConversations(convResult.conversations)
        setSelectedId(result.conversationId)
        const conv = convResult.conversations.find((c) => c.id === result.conversationId)
        setSelectedParticipant(conv?.participant || null)
        setShowMobileChat(true)
      }
    }
  }, [])

  return (
    <>
      <Topbar title="Messages" />
      
      {/* Hide bottom nav when mobile chat is open */}
      {showMobileChat && (
        <style>{`@media (max-width: 767px) { nav.fixed.bottom-0 { display: none !important; } }`}</style>
      )}
      
      <div className={cn(
        "flex-1 flex overflow-hidden",
        showMobileChat ? "h-[calc(100dvh-4rem)]" : "h-[calc(100dvh-4rem)] pb-16 md:pb-0"
      )}>
        {/* Conversation List - Hidden on mobile when chat is open */}
        <div className={showMobileChat ? "hidden md:flex" : "flex w-full md:w-auto"}>
          <div className="w-full md:w-80 lg:w-96 border-r flex flex-col bg-background h-full">
            {/* Header with New Chat button */}
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Messages</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowUserSearch(true)}
                className="h-8 w-8"
              >
                <HugeiconsIcon icon={UserAdd01Icon} size={18} />
              </Button>
            </div>
            
            {isLoading ? (
              <ConversationListSkeleton count={6} />
            ) : (
              <ConversationList
                conversations={mappedConversations}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col bg-muted/10 overflow-hidden ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
          {selectedParticipant ? (
            <>
              <ChatHeader
                name={selectedParticipant.name}
                avatar={selectedParticipant.avatar || undefined}
                isOnline={selectedParticipant.isOnline}
                showBackButton
                onBack={() => setShowMobileChat(false)}
                onVideoCall={() => setActiveCall({ type: "video" })}
                onAudioCall={() => setActiveCall({ type: "audio" })}
              />

              {isLoadingMessages ? (
                <div className="flex-1 overflow-hidden">
                  <MessagesAreaSkeleton />
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto max-h-[calc(100vh-16rem)] md:max-h-[calc(100vh-12rem)]">
                    <div className="px-3 py-4 space-y-1 max-w-3xl mx-auto w-full">
                      {messageGroups.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        messageGroups.map((group) => (
                          <div key={group.date.toISOString()}>
                            <DateSeparator date={group.date} />
                            <div className="space-y-1">
                              {group.messages.map((msg, i) => {
                                const prev = group.messages[i - 1]
                                return (
                                  <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    showAvatar={!prev || prev.senderId !== msg.senderId}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <MessageInput
                    onSendMessage={handleSendMessage}
                  />
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <HugeiconsIcon icon={Message01Icon} size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a conversation or start a new one</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowUserSearch(true)}
                >
                  <HugeiconsIcon icon={UserAdd01Icon} size={16} className="mr-2" />
                  New Conversation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Search Modal (bottom sheet on mobile) */}
      <ResponsiveModal open={showUserSearch} onOpenChange={setShowUserSearch}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>New Conversation</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-4">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => {
                    setSearchQuery("")
                    setSearchResults([])
                  }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} />
                </Button>
              )}
            </div>

            <ScrollArea className="h-[300px]">
              {searchQuery.length >= 2 ? (
                isSearching ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No users found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleStartConversation(user)}
                        className="w-full p-3 text-left hover:bg-muted rounded-lg transition-colors flex items-center gap-3"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback>{user.name[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{user.username} · {user.role}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recently Added
                  </p>
                  {isLoadingRecent ? (
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                          <div className="h-3 w-10 rounded bg-muted animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : recentUsers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No users yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {recentUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleStartConversation(user)}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-muted transition-colors"
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback className="text-sm">
                              {user.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-xs font-medium truncate w-full text-center">
                            {user.name.split(" ")[0]}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Video Call Modal */}
      {selectedParticipant && (
        <VideoCall
          open={!!activeCall}
          onClose={() => setActiveCall(null)}
          callType={activeCall?.type || "video"}
          callerName={selectedParticipant.name}
          callerAvatar={selectedParticipant.avatar || undefined}
        />
      )}
    </>
  )
}
