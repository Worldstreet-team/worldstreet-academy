"use client"

import { useState, useRef, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MailSend01Icon,
  Add01Icon,
  Mic01Icon,
  Image02Icon,
  Video01Icon,
  FileEditIcon,
  Camera01Icon,
  Cancel01Icon,
  StopIcon,
  PlayIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Attachment = {
  file: File
  preview?: string
  type: "image" | "video" | "document" | "audio"
}

type MessageInputProps = {
  onSendMessage: (content: string, attachments?: Attachment[]) => void
  onEditMedia?: (attachment: Attachment) => void
  disabled?: boolean
}

export function MessageInput({ onSendMessage, onEditMedia, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const hasContent = message.trim().length > 0 || attachments.length > 0 || audioBlob

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        setAudioBlob(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error("Failed to start recording:", err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setAudioBlob(null)
    setRecordingTime(0)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleFileSelect = (accept: string, type: Attachment["type"]) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept
      fileInputRef.current.onclick = () => {
        fileInputRef.current!.value = ""
      }
      fileInputRef.current.onchange = (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || [])
        const newAttachments: Attachment[] = files.map((file) => ({
          file,
          type,
          preview: type === "image" || type === "video" ? URL.createObjectURL(file) : undefined,
        }))
        setAttachments((prev) => [...prev, ...newAttachments])
      }
      fileInputRef.current.click()
    }
    setIsPopoverOpen(false)
  }

  const handleCamera = async () => {
    setIsPopoverOpen(false)
    console.log("Camera capture - implement modal")
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const attachment = prev[index]
      if (attachment.preview) URL.revokeObjectURL(attachment.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSend = () => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" })
      onSendMessage("", [{ file: audioFile, type: "audio" }])
      setAudioBlob(null)
      setRecordingTime(0)
    } else if (message.trim() || attachments.length > 0) {
      onSendMessage(message, attachments.length > 0 ? attachments : undefined)
      setMessage("")
      setAttachments([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Cleanup attachment previews when component unmounts
  useEffect(() => {
    const currentAttachments = attachments
    return () => {
      currentAttachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview))
    }
  }, [attachments])

  // Voice recording UI
  if (isRecording || audioBlob) {
    return (
      <div className="border-t bg-background px-3 py-2">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 text-destructive"
            onClick={cancelRecording}
          >
            <HugeiconsIcon icon={Delete02Icon} size={20} />
          </Button>

          <div className="flex-1 flex items-center gap-3 bg-muted rounded-full px-4 py-2">
            {isRecording ? (
              <>
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
                <div className="flex-1 flex items-center justify-center gap-0.5">
                  {[8,16,12,20,14,18,10,22,16,12,20,8,18,14,10,24,16,12,20,14].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary/60 rounded-full animate-pulse"
                      style={{
                        height: `${h}px`,
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <HugeiconsIcon icon={PlayIcon} size={16} />
                </Button>
                <div className="flex-1 h-1 bg-primary/30 rounded-full">
                  <div className="h-full w-0 bg-primary rounded-full" />
                </div>
                <span className="text-xs text-muted-foreground">{formatTime(recordingTime)}</span>
              </>
            )}
          </div>

          <Button
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={isRecording ? stopRecording : handleSend}
          >
            <HugeiconsIcon icon={isRecording ? StopIcon : MailSend01Icon} size={20} />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t bg-background px-3 py-2">
      <input ref={fileInputRef} type="file" className="hidden" />

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2 max-w-4xl mx-auto">
          {attachments.map((attachment, index) => (
            <div key={index} className="relative shrink-0 group">
              {attachment.type === "image" && attachment.preview ? (
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : attachment.type === "video" && attachment.preview ? (
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted relative">
                  <video src={attachment.preview} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <HugeiconsIcon icon={Video01Icon} size={20} className="text-white" />
                  </div>
                </div>
              ) : (
                <div className="h-16 px-3 rounded-lg bg-muted flex items-center gap-2">
                  <HugeiconsIcon icon={FileEditIcon} size={16} />
                  <span className="text-xs max-w-20 truncate">{attachment.file.name}</span>
                </div>
              )}
              
              {(attachment.type === "image" || attachment.type === "video") && onEditMedia && (
                <button
                  onClick={() => onEditMedia(attachment)}
                  className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <HugeiconsIcon icon={FileEditIcon} size={10} />
                </button>
              )}
              
              <button
                onClick={() => removeAttachment(index)}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        {/* Attachment Popover */}
        <div className={cn(
          "transition-all duration-200",
          hasContent ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
        )}>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  disabled={disabled}
                >
                  <HugeiconsIcon icon={Add01Icon} size={22} />
                </Button>
              }
            />
            <PopoverContent side="top" align="start" className="w-auto p-2">
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => handleFileSelect("image/*", "image")}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center">
                    <HugeiconsIcon icon={Image02Icon} size={20} />
                  </div>
                  <span className="text-xs">Photo</span>
                </button>
                <button
                  onClick={() => handleFileSelect("video/*", "video")}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <HugeiconsIcon icon={Video01Icon} size={20} />
                  </div>
                  <span className="text-xs">Video</span>
                </button>
                <button
                  onClick={() => handleFileSelect(".pdf,.doc,.docx,.txt,.xls,.xlsx", "document")}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <HugeiconsIcon icon={FileEditIcon} size={20} />
                  </div>
                  <span className="text-xs">File</span>
                </button>
                <button
                  onClick={handleCamera}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                    <HugeiconsIcon icon={Camera01Icon} size={20} />
                  </div>
                  <span className="text-xs">Camera</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Text Input */}
        <div className="flex-1 flex items-center bg-muted rounded-full px-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Send / Voice Button */}
        {hasContent ? (
          <Button
            size="icon"
            className="h-10 w-10 rounded-full shrink-0"
            onClick={handleSend}
            disabled={disabled}
          >
            <HugeiconsIcon icon={MailSend01Icon} size={20} />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0"
            onClick={startRecording}
            disabled={disabled}
          >
            <HugeiconsIcon icon={Mic01Icon} size={22} />
          </Button>
        )}
      </div>
    </div>
  )
}

export type { Attachment }
