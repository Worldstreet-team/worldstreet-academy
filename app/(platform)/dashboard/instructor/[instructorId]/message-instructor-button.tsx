"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Message01Icon } from "@hugeicons/core-free-icons"
import { getOrCreateConversation } from "@/lib/actions/messages"

interface MessageInstructorButtonProps {
  instructorId: string
}

export function MessageInstructorButton({ instructorId }: MessageInstructorButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleMessage = () => {
    startTransition(async () => {
      const result = await getOrCreateConversation(instructorId)
      if (result.success && result.conversationId) {
        router.push(`/dashboard/messages?c=${result.conversationId}`)
      }
    })
  }

  return (
    <Button
      variant="default"
      size="sm"
      className="gap-1.5"
      onClick={handleMessage}
      disabled={isPending}
    >
      <HugeiconsIcon icon={Message01Icon} size={14} />
      {isPending ? "Opening..." : "Message Instructor"}
    </Button>
  )
}
