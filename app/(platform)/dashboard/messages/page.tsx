"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Message01Icon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ConversationList,
  ChatHeader,
  MessageBubble,
  MessageInput,
  DateSeparator,
  groupMessagesByDate,
  MediaEditor,
  type Conversation,
  type MessageType,
  type Attachment,
} from "@/components/messages"

// Mock conversations
const mockConversations: Conversation[] = [
  {
    id: "1",
    name: "Sarah Chen",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    lastMessage: "Let me know if you have any questions!",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unread: 1,
    isOnline: true,
  },
  {
    id: "2",
    name: "Marcus Johnson",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
    lastMessage: "Thanks for enrolling!",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    unread: 0,
    isOnline: false,
  },
  {
    id: "3",
    name: "Dr. Lisa Park",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa",
    lastMessage: "Great question!",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    unread: 0,
    isOnline: true,
  },
]

// Mock messages
const mockMessages: MessageType[] = [
  {
    id: "1",
    senderId: "instructor",
    senderName: "Sarah Chen",
    senderAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    content: "Welcome to the course! Feel free to ask questions.",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    isOwn: false,
  },
  {
    id: "2",
    senderId: "user",
    content: "Thank you! I'm excited to start.",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    isOwn: true,
    isRead: true,
  },
  {
    id: "3",
    senderId: "instructor",
    senderName: "Sarah Chen",
    senderAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    content: "Here's a guide to help you get started",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isOwn: false,
    type: "file",
    fileName: "Getting_Started_Guide.pdf",
    fileSize: "2.4 MB",
  },
  {
    id: "4",
    senderId: "user",
    content: "This is really helpful, thanks!",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    isOwn: true,
    isRead: true,
  },
  {
    id: "5",
    senderId: "instructor",
    senderName: "Sarah Chen",
    senderAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    content: "Let me know if you have any questions!",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isOwn: false,
  },
]

export default function MessagesPage() {
  const [selectedId, setSelectedId] = useState<string | null>("1")
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [editingMedia, setEditingMedia] = useState<{ file: File; type: "image" | "video" } | null>(null)
  
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
    <>
      <Topbar title="Messages" />
      
      <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Conversation List - Hidden on mobile when chat is open */}
        <div className={showMobileChat ? "hidden md:flex" : "flex w-full md:w-auto"}>
          <ConversationList
            conversations={mockConversations}
            selectedId={selectedId}
            onSelect={handleSelect}
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
                onVideoCall={() => console.log("Video call")}
                onAudioCall={() => console.log("Audio call")}
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
    </>
  )
}
