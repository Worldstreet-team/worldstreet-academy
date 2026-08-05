"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUser } from "@/components/providers/user-provider"
import {
  submitInstructorApplication,
  getMyInstructorApplication,
  withdrawInstructorApplication,
  pickInterviewSlot,
  type ApplicationAnswersInput,
} from "@/lib/actions/applications"
import { getVideoUploadUrl, getDocumentUploadUrl } from "@/lib/actions/upload"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { CircleCheckBigIcon, GraduationCapIcon, XIcon } from "lucide-react"

/* ── Upload-or-paste field (sample video / CV) ── */

function UploadField({
  label,
  accept,
  kind,
  value,
  onChange,
  placeholder,
}: {
  label: string
  accept: string
  kind: "video" | "document"
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const presign =
        kind === "video"
          ? await getVideoUploadUrl(file.name, file.type)
          : await getDocumentUploadUrl(file.name, file.type)
      if (!presign.success || !presign.uploadUrl || !presign.publicUrl) {
        setUploadError(presign.error ?? "Upload failed")
        return
      }
      const res = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!res.ok) {
        setUploadError("Upload failed — try again")
        return
      }
      onChange(presign.publicUrl)
    } catch {
      setUploadError("Upload failed — try again")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {uploadError && <p className="text-[10px] text-destructive">{uploadError}</p>}
    </div>
  )
}

const EXPERIENCE_OPTIONS = ["<1", "1-3", "3-5", "5+"]

/* ── Status tracker ── */

const TRACKER_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "interview_scheduled", label: "Interview" },
  { key: "decision", label: "Decision" },
] as const

function statusIndex(status: string): number {
  switch (status) {
    case "submitted":
      return 0
    case "under_review":
      return 1
    case "interview_scheduled":
      return 2
    case "approved":
    case "rejected":
      return 3
    default:
      return 0
  }
}

function StatusTracker({ status }: { status: string }) {
  const current = statusIndex(status)
  return (
    <div className="flex items-center gap-1.5">
      {TRACKER_STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center gap-1 min-w-0">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 transition-colors ${
                i < current
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === current
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground/50"
              }`}
            >
              {i < current ? (
                <CircleCheckBigIcon  size={13} />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-[9px] whitespace-nowrap ${
                i <= current ? "text-foreground font-medium" : "text-muted-foreground/60"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < TRACKER_STEPS.length - 1 && (
            <div
              className={`h-0.5 flex-1 rounded-full mb-4 ${
                i < current ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

/* ── Multi-step application form ── */

function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [step, setStep] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const [headline, setHeadline] = React.useState("")
  const [expertiseInput, setExpertiseInput] = React.useState("")
  const [expertise, setExpertise] = React.useState<string[]>([])
  const [experienceYears, setExperienceYears] = React.useState("")
  const [experience, setExperience] = React.useState("")
  const [motivation, setMotivation] = React.useState("")
  const [portfolioUrl, setPortfolioUrl] = React.useState("")
  const [linkedin, setLinkedin] = React.useState("")
  const [twitter, setTwitter] = React.useState("")
  const [website, setWebsite] = React.useState("")
  const [sampleVideoUrl, setSampleVideoUrl] = React.useState("")
  const [cvUrl, setCvUrl] = React.useState("")
  const [termsAccepted, setTermsAccepted] = React.useState(false)

  const submit = useMutation({
    mutationFn: (input: ApplicationAnswersInput) => submitInstructorApplication(input),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error ?? "Failed to submit")
      } else {
        setError(null)
        onSubmitted()
      }
    },
  })

  const addExpertise = () => {
    const tag = expertiseInput.trim()
    if (tag && !expertise.includes(tag) && expertise.length < 8) {
      setExpertise((prev) => [...prev, tag])
    }
    setExpertiseInput("")
  }

  const canNext =
    step === 0
      ? headline.trim().length >= 10 && expertise.length > 0 && experienceYears
      : step === 1
        ? experience.trim().length >= 50 && motivation.trim().length >= 50
        : true

  const steps = ["Your expertise", "Experience & motivation", "Links & submit"]

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {steps.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-5 w-5 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                    i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-xs hidden sm:inline ${
                    i <= step ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: expertise */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Professional headline <span className="text-destructive">*</span>
              </label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder='e.g. "Senior DeFi analyst & on-chain researcher"'
                maxLength={120}
              />
              <p className="text-[10px] text-muted-foreground">
                Shown on your public instructor profile. At least 10 characters.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Areas of expertise <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addExpertise()
                    }
                  }}
                  placeholder="e.g. Technical Analysis — press Enter to add"
                />
                <Button type="button" variant="outline" size="sm" onClick={addExpertise}>
                  Add
                </Button>
              </div>
              {expertise.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {expertise.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setExpertise((prev) => prev.filter((t) => t !== tag))}
                        aria-label={`Remove ${tag}`}
                      >
                        <XIcon  size={10} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Years of experience <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setExperienceYears(opt)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      experienceYears === opt
                        ? "bg-foreground text-background border-foreground"
                        : "border-ws-hairline text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {opt} yrs
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: experience + motivation */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Tell us about your experience <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Your trading/teaching background, credentials, notable work…"
                className="min-h-28"
                maxLength={2000}
              />
              <p className="text-[10px] text-muted-foreground">
                {experience.trim().length}/2000 — at least 50 characters.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Why do you want to teach on WorldStreet? <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="What will you teach, and why are you the right person to teach it?"
                className="min-h-28"
                maxLength={2000}
              />
              <p className="text-[10px] text-muted-foreground">
                {motivation.trim().length}/2000 — at least 50 characters.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: links */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Optional — but a sample video or CV makes review much faster.
            </p>
            <div className="space-y-3">
              <UploadField
                label="Sample teaching video"
                accept="video/*"
                kind="video"
                value={sampleVideoUrl}
                onChange={setSampleVideoUrl}
                placeholder="Paste a link (YouTube, Loom…) or upload"
              />
              <UploadField
                label="CV / credentials (PDF)"
                accept="application/pdf"
                kind="document"
                value={cvUrl}
                onChange={setCvUrl}
                placeholder="Paste a link or upload a PDF"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Portfolio / work URL</label>
                  <Input
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">LinkedIn</label>
                  <Input
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/…"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Twitter / X</label>
                  <Input
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="x.com/…"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Website</label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>

              {/* Terms of teaching */}
              <label className="flex items-start gap-2.5 rounded-lg border border-ws-hairline px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  I agree to the WorldStreet Academy instructor terms: original content only,
                  85/15 revenue share, refund-window clawbacks, and course quality standards.
                </span>
              </label>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Nav buttons */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 0 || submit.isPending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button type="button" size="sm" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={submit.isPending || !termsAccepted}
              onClick={() =>
                submit.mutate({
                  headline,
                  expertise,
                  experienceYears,
                  experience,
                  motivation,
                  portfolioUrl: portfolioUrl || undefined,
                  linkedin: linkedin || undefined,
                  twitter: twitter || undefined,
                  website: website || undefined,
                  sampleVideoUrl: sampleVideoUrl || undefined,
                  cvUrl: cvUrl || undefined,
                  termsAccepted,
                })
              }
            >
              {submit.isPending ? "Submitting…" : "Submit application"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ── Page ── */

export default function BecomeInstructorPage() {
  const user = useUser()
  const queryClient = useQueryClient()
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)
  const [reapplying, setReapplying] = React.useState(false)

  const { data: application, isLoading } = useQuery({
    queryKey: queryKeys.myApplication,
    queryFn: () => getMyInstructorApplication(),
    enabled: user.role === "USER",
  })

  const withdraw = useMutation({
    mutationFn: () => withdrawInstructorApplication(),
    onSuccess: () => {
      setWithdrawOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.myApplication })
    },
  })

  const [slotError, setSlotError] = React.useState<string | null>(null)
  const pickSlot = useMutation({
    mutationFn: (slotAt: string) => pickInterviewSlot(application!.id, slotAt),
    onSuccess: (res) => {
      if (!res.success) setSlotError(res.error ?? "Failed to confirm the slot")
      else setSlotError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.myApplication })
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.myApplication })

  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN"
  const activeStatuses = ["submitted", "under_review", "interview_scheduled"]
  const isActive = application && activeStatuses.includes(application.status)
  const isRejected = application?.status === "rejected" && !reapplying
  const showForm =
    !isInstructor &&
    !isLoading &&
    (!application ||
      application.status === "withdrawn" ||
      (application.status === "rejected" && reapplying))

  return (
    <>
      <Topbar />
      <div className="p-4 sm:p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 max-w-2xl mx-auto space-y-5">
        <div className="text-center space-y-2 py-4">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <GraduationCapIcon  size={24} />
          </div>
          <h1 className="text-xl font-semibold">Become an instructor</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Teach crypto, trading and blockchain to thousands of WorldStreet students — and earn
            85% of every sale.
          </p>
        </div>

        {isInstructor ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm font-medium">You already have instructor access</p>
              <p className="text-xs text-muted-foreground">
                Head to your instructor portal to create and manage courses.
              </p>
              <Button size="sm" render={<Link href="/instructor" />}>
                Open Instructor Portal
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : isActive && application ? (
          <Card>
            <CardContent className="p-5 space-y-5">
              <StatusTracker status={application.status} />
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="text-xs font-medium">{application.answers.headline}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Submitted {new Date(application.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  {" · "}
                  {application.status === "submitted"
                    ? "waiting for review"
                    : application.status === "under_review"
                      ? "an admin is reviewing your application"
                      : "interview scheduled — see below"}
                </p>
              </div>
              {application.proposedSlots.length > 0 && !application.interview && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 space-y-2">
                  <p className="text-xs font-semibold">Pick your interview time</p>
                  <p className="text-[11px] text-muted-foreground">
                    Our team proposed {application.proposedSlots.length} time
                    {application.proposedSlots.length === 1 ? "" : "s"} — choose what works for you.
                  </p>
                  <div className="space-y-1.5">
                    {application.proposedSlots.map((slot) => (
                      <button
                        key={slot.at}
                        type="button"
                        disabled={pickSlot.isPending}
                        onClick={() => pickSlot.mutate(slot.at)}
                        className="w-full flex items-center justify-between rounded-lg border border-ws-hairline bg-background px-3 py-2 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        <span className="text-xs font-medium">
                          {new Date(slot.at).toLocaleString("en-US", {
                            dateStyle: "full",
                            timeStyle: "short",
                          })}
                        </span>
                        <span className="text-[10px] text-primary font-semibold">
                          {pickSlot.isPending ? "Confirming…" : "Choose"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {slotError && <p className="text-[11px] text-destructive">{slotError}</p>}
                </div>
              )}
              {application.status === "interview_scheduled" && application.interview && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold">Your interview call</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {application.interview.scheduledAt
                        ? new Date(application.interview.scheduledAt).toLocaleString("en-US", {
                            dateStyle: "full",
                            timeStyle: "short",
                          })
                        : "Time to be confirmed"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      Join at the scheduled time — you&apos;ll be admitted from the waiting room.
                    </p>
                  </div>
                  <Button size="sm" render={<Link href={application.interview.joinPath} />}>
                    Join interview
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  We&apos;ll notify you by email and in the app.
                </p>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => setWithdrawOpen(true)}
                >
                  Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isRejected && application ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm font-medium">Your application wasn&apos;t approved</p>
              {application.decisionNote && (
                <p className="text-xs text-muted-foreground border-l-2 border-border pl-3 text-left max-w-sm mx-auto">
                  {application.decisionNote}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                You&apos;re welcome to apply again with more detail.
              </p>
              <Button size="sm" variant="outline" onClick={() => setReapplying(true)}>
                Apply again
              </Button>
            </CardContent>
          </Card>
        ) : showForm ? (
          <ApplicationForm onSubmitted={refresh} />
        ) : null}

        {/* How it works */}
        {!isInstructor && (
          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            {[
              { step: "1", title: "Apply", body: "Tell us about your expertise and what you'll teach." },
              { step: "2", title: "Interview", body: "Our team reviews and may invite you to a short call." },
              { step: "3", title: "Teach & earn", body: "Publish courses and earn 85% of every sale." },
            ].map((item) => (
              <div key={item.step} className="rounded-lg border border-ws-hairline p-3.5">
                <span className="text-[10px] font-bold text-primary">STEP {item.step}</span>
                <p className="text-xs font-semibold mt-1">{item.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw confirm */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw your application?</DialogTitle>
            <DialogDescription>
              Your application will be closed. You can apply again any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(false)}>
              Keep it
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate()}
            >
              {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
