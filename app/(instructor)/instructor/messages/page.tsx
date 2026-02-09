"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Message01Icon } from "@hugeicons/core-free-icons"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ConversationList,
  ChatHeader,
  MessageBubble,
  MessageInput,
  DateSeparator,
  groupMessagesByDate,
  MediaEditor,
  VideoCall,
  type Conversation,
  type MessageType,
  type Attachment,
} from "@/components/messages"

// Mock conversations
const mockConversations: Conversation[] = [
  {
    id: "1",
    name: "Alex Thompson",
    lastMessage: "I had a question about lesson 3.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unread: 2,
    isOnline: true,
  },
  {
    id: "2",
    name: "Emily Davis",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
    lastMessage: "Got it, thanks!",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    unread: 0,
    isOnline: false,
  },
  {
    id: "3",
    name: "Michael Brown",
    lastMessage: "When will the next lesson be available?",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    unread: 1,
    isOnline: true,
  },
]

// Mock messages
const mockMessages: MessageType[] = [
  {
    id: "1",
    senderId: "student-1",
    senderName: "Alex Thompson",
    content: "Hi! I just enrolled in your course.",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    isOwn: false,
  },
  {
    id: "2",
    senderId: "instructor",
    content: "Welcome! Feel free to ask any questions.",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    isOwn: true,
    isRead: true,
  },
  {
    id: "3",
    senderId: "student-1",
    senderName: "Alex Thompson",
    content: "I had a question about lesson 3.",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isOwn: false,
  },
  {
    id: "4",
    senderId: "instructor",
    content: "Sure! What would you like to know?",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
    isOwn: true,
    isRead: true,
  },
  {
    id: "5",
    senderId: "student-1",
    senderName: "Alex Thompson",
    content: "I'm confused about the trading strategies.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isOwn: false,
  },
  {
    id: "6",
    senderId: "instructor",
    content: "Here's a guide that should help",
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    isOwn: true,
    type: "file",
    fileName: "Trading_Guide.pdf",
    fileSize: "2.3 MB",
    isRead: false,
  },
]

export default function InstructorMessagesPage() {
  const [selectedId, setSelectedId] = useState<string | null>("1")
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [editingMedia, setEditingMedia] = useState<{ file: File; type: "image" | "video" } | null>(null)
  const [activeCall, setActiveCall] = useState<{ type: "video" | "audio" } | null>(null)
  
  const selected = mockConversations.find((c) => c.id === selectedId)
  const messageGroups = groupMessagesByDate(mockMessages)

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setShowMobileChat(true)
  }

  const handleSendMessage = (content: string, attachments?: Attachment[]) => {
    console.log("Send:", content, attachments)
  }

  const handleEditMedia = (attachment: Attachment) => {
    if (attachment.type === "image" || attachment.type === "video") {
      setEditingMedia({ file: attachment.file, type: attachment.type })
    }
  }

  return (
    <div className="flex-1 flex h-screen overflow-hidden">
      {/* Conversation List */}
      <div className={showMobileChat ? "hidden md:flex" : "flex w-full md:w-auto"}>
        <ConversationList
          conversations={mockConversations}
          selectedId={selectedId}
          onSelect={handleSelect}
          searchPlaceholder="Search students..."
        />
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-muted/10 ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
        {selected ? (
          <>
            <ChatHeader
              name={selected.name}
              avatar={selected.avatar}
              isOnline={selected.isOnline}
              showBackButton
              onBack={() => setShowMobileChat(false)}
              onVideoCall={() => setActiveCall({ type: "video" })}
              onAudioCall={() => setActiveCall({ type: "audio" })}
            />

            <ScrollArea className="flex-1">
              <div className="px-3 py-4 space-y-1 max-w-3xl mx-auto">
                {messageGroups.map((group) => (
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
                ))}
              </div>
            </ScrollArea>

            <MessageInput
              onSendMessage={handleSendMessage}
              onEditMedia={handleEditMedia}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <HugeiconsIcon icon={Message01Icon} size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Media Editor Modal */}
      <MediaEditor
        open={!!editingMedia}
        onClose={() => setEditingMedia(null)}
        file={editingMedia?.file || null}
        type={editingMedia?.type || "image"}
        onSave={(file) => {
          console.log("Edited file:", file)
          setEditingMedia(null)
        }}
      />

      {/* Video Call Modal */}
      {selected && (
        <VideoCall
          open={!!activeCall}
          onClose={() => setActiveCall(null)}
          callType={activeCall?.type || "video"}
          callerName={selected.name}
          callerAvatar={selected.avatar}
        />
      )}
    </div>
  )
}
