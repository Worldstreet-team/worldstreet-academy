"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getOrCreateConversation } from "@/lib/actions/messages"
import { MessageSquareIcon } from "lucide-react"

interface MessageInstructorButtonProps {
  instructorId: string
}

export function MessageInstructorButton({ instructorId }: MessageInstructorButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleMessage = () => {
    setError(null)
    startTransition(async () => {
      const result = await getOrCreateConversation(instructorId)
      if (result.success && result.conversationId) {
        router.push(`/dashboard/messages?c=${result.conversationId}`)
      } else {
        setError(result.error ?? "Couldn't open a conversation")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="default"
        size="sm"
        className="gap-1.5"
        onClick={handleMessage}
        disabled={isPending}
      >
        <MessageSquareIcon  size={14} />
        {isPending ? "Opening..." : "Message Instructor"}
      </Button>
      {error && <p className="text-[11px] text-ws-danger">{error}</p>}
    </div>
  )
}
