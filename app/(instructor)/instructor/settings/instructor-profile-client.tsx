"use client"

import { useRef, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { SignatureCanvas } from "@/components/shared/signature-canvas"
import { updateAvatar, updateProfile } from "@/lib/actions/profile"
import { getImageUploadUrl } from "@/lib/actions/upload"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Camera02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { LocalUser } from "@/lib/auth/sync"

export function InstructorProfileClient({
  user,
  currentSignatureUrl,
}: {
  user: LocalUser | null
  currentSignatureUrl: string | null
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl ?? null)
  const [signatureUrl, setSignatureUrl] = useState(currentSignatureUrl)
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false)

  const [firstName, setFirstName] = useState(user?.firstName ?? "")
  const [lastName, setLastName] = useState(user?.lastName ?? "")
  const [bio, setBio] = useState(user?.bio ?? "")
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "I"
  const fullName =
    `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Instructor"

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return
    setIsUploading(true)
    try {
      const result = await getImageUploadUrl(file.name, file.type)
      if (!result.success || !result.uploadUrl || !result.publicUrl) return
      await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      await updateAvatar(result.publicUrl)
      setAvatarPreview(result.publicUrl)
    } catch (err) {
      console.error("Avatar upload error:", err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveProfile = () => {
    startTransition(async () => {
      const result = await updateProfile({ firstName, lastName, bio })
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    })
  }

  return (
    <>
      {/* ── Profile card with avatar ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar row */}
          <div className="flex items-center gap-5">
            <button
              type="button"
              className="group relative shrink-0"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploading}
            >
              <Avatar className="h-16 w-16 ring-2 ring-neutral-100 dark:ring-neutral-800">
                {avatarPreview && (
                  <AvatarImage src={avatarPreview} alt={fullName} />
                )}
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity",
                  isUploading
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
              >
                {isUploading ? (
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <HugeiconsIcon
                    icon={Camera02Icon}
                    size={16}
                    className="text-white"
                  />
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleAvatarUpload(f)
                  e.target.value = ""
                }}
              />
            </button>
            <div>
              <p className="text-sm font-semibold">{fullName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="min-h-20"
              placeholder="Describe your teaching background…"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save Profile"}
            </Button>
            {saved && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <HugeiconsIcon icon={Tick02Icon} size={14} />
                Saved
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Signature card ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Certificate Signature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Draw or upload your signature. It will appear on student
            certificates.
          </p>

          {signatureUrl && !showSignatureCanvas ? (
            <div className="flex items-center gap-4">
              <div className="w-48 h-20 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 flex items-center justify-center overflow-hidden">
                <img
                  src={signatureUrl}
                  alt="Your signature"
                  className="h-full w-auto object-contain p-2"
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <HugeiconsIcon icon={Tick02Icon} size={14} />
                  Signature saved
                </p>
                <button
                  onClick={() => setShowSignatureCanvas(true)}
                  className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                >
                  Change signature
                </button>
              </div>
            </div>
          ) : (
            <SignatureCanvas
              currentSignatureUrl={signatureUrl}
              onSave={(url) => {
                setSignatureUrl(url)
                setShowSignatureCanvas(false)
              }}
              onCancel={
                signatureUrl ? () => setShowSignatureCanvas(false) : undefined
              }
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}
