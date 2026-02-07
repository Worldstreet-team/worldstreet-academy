"use client"

import { useState, useEffect } from "react"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon } from "@hugeicons/core-free-icons"

interface LinkInputModalProps {
  /** Current URL value */
  value: string
  /** Called when user confirms the URL */
  onConfirm: (url: string) => void
  /** Called when user removes the URL (shows Remove button when value exists) */
  onRemove?: () => void
  /** Modal title */
  label: string
  /** Optional description below the title */
  description?: string
  /** Input placeholder */
  placeholder?: string
  /** Trigger element – rendered as-is; clicking it opens the modal */
  children: React.ReactNode
}

export function LinkInputModal({
  value,
  onConfirm,
  onRemove,
  label,
  description,
  placeholder = "https://...",
  children,
}: LinkInputModalProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  /* Sync internal input when opening */
  useEffect(() => {
    if (open) setUrl(value)
  }, [open, value])

  function handleConfirm() {
    onConfirm(url.trim())
    setOpen(false)
  }

  function handleRemove() {
    onRemove?.()
    setUrl("")
    setOpen(false)
  }

  return (
    <>
      {/* biome-ignore lint: trigger wrapper */}
      <span
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        role="button"
        tabIndex={0}
        className="inline-flex"
      >
        {children}
      </span>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{label}</ResponsiveModalTitle>
            {description && (
              <ResponsiveModalDescription>
                {description}
              </ResponsiveModalDescription>
            )}
          </ResponsiveModalHeader>

          <Input
            type="url"
            placeholder={placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) handleConfirm()
            }}
            autoFocus
          />

          <ResponsiveModalFooter>
            {value && onRemove && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
              >
                <HugeiconsIcon icon={Delete01Icon} size={14} />
                Remove
              </Button>
            )}
            <Button size="sm" onClick={handleConfirm} disabled={!url.trim()}>
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  )
}
