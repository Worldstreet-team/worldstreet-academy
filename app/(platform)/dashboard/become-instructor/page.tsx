"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Mortarboard01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { BRAND } from "@/lib/brand"

/* v2 surfaces: 20px cards on the card fill — no outline in dark, hairline in
   light — and a 44/40px control height shared by fields and their buttons. */
const PANEL = "rounded-[20px] border border-ws-hairline bg-card dark:border-transparent"
const CONTROL_BUTTON = "h-11 md:h-10 px-4 text-[13px]"

/* ── Field shell: label → control → hint, one rhythm for every field ── */

function FormField({
  label,
  htmlFor,
  required,
  hint,
  count,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: React.ReactNode
  /** Right-aligned live counter under the control, e.g. "120 / 2000". */
  count?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {(hint || count) && (
        <div className="flex items-start justify-between gap-4 text-[12.5px] leading-relaxed text-muted-foreground">
          <span>{hint}</span>
          {count && <span className="shrink-0 tabular-nums">{count}</span>}
        </div>
      )}
    </div>
  )
}

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
  const id = React.useId()
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
    <FormField
      label={label}
      htmlFor={id}
      hint={uploadError ? <span className="text-destructive">{uploadError}</span> : undefined}
    >
      <div className="flex gap-2.5">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
          className={CONTROL_BUTTON}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <HugeiconsIcon icon={Upload04Icon} className="size-4" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </FormField>
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
    <ol className="flex items-start gap-2">
      {TRACKER_STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <li className="flex min-w-0 flex-col items-center gap-2" aria-current={i === current ? "step" : undefined}>
            <span
              className={`flex size-8 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors ${
                i < current
                  ? "bg-primary text-primary-foreground"
                  : i === current
                    ? "bg-primary/15 text-primary ring-1 ring-primary/50"
                    : "bg-surface-sunken text-muted-foreground"
              }`}
            >
              {i < current ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" /> : i + 1}
            </span>
            <span
              className={`whitespace-nowrap text-[12px] ${
                i <= current ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </li>
          {i < TRACKER_STEPS.length - 1 && (
            <li aria-hidden className={`mt-4 h-px flex-1 ${i < current ? "bg-primary" : "bg-border"}`} />
          )}
        </React.Fragment>
      ))}
    </ol>
  )
}

/* ── Multi-step application form ── */

const STEPS = [
  { title: "Your expertise", description: "How students will find you, and what you know best." },
  { title: "Experience & motivation", description: "Tell the review team about your background." },
  { title: "Links & submit", description: "Optional — but a sample video or CV makes review much faster." },
]

function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const ids = {
    headline: React.useId(),
    expertise: React.useId(),
    experience: React.useId(),
    motivation: React.useId(),
    portfolio: React.useId(),
    linkedin: React.useId(),
    twitter: React.useId(),
    website: React.useId(),
  }
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

  // What stands between the student and the next step — said beside the CTA
  // instead of leaving a silent disabled button.
  const blocker =
    step === 0
      ? headline.trim().length < 10
        ? "Headline needs at least 10 characters"
        : expertise.length === 0
          ? "Add at least one area of expertise"
          : !experienceYears
            ? "Pick your years of experience"
            : null
      : step === 1
        ? experience.trim().length < 50
          ? "Experience needs at least 50 characters"
          : motivation.trim().length < 50
            ? "Motivation needs at least 50 characters"
            : null
        : !termsAccepted
          ? "Accept the instructor terms to submit"
          : null

  return (
    <section className={`${PANEL} p-6 sm:p-8`}>
      {/* Step indicator */}
      <ol className="flex items-center gap-3">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.title}>
            <li className="flex items-center gap-2.5" aria-current={i === step ? "step" : undefined}>
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors ${
                  i <= step ? "bg-primary text-primary-foreground" : "bg-surface-sunken text-muted-foreground"
                }`}
              >
                {i < step ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" /> : i + 1}
              </span>
              <span
                className={`hidden text-[13px] md:inline ${
                  i === step ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.title}
              </span>
            </li>
            {i < STEPS.length - 1 && <li aria-hidden className="h-px min-w-4 flex-1 bg-border" />}
          </React.Fragment>
        ))}
      </ol>

      <div className="mt-8 space-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-foreground">
          {STEPS[step].title}
        </h2>
        <p className="text-[14px] text-muted-foreground">{STEPS[step].description}</p>
      </div>

      <div className="mt-7 space-y-6">
        {/* Step 0: expertise */}
        {step === 0 && (
          <>
            <FormField
              label="Professional headline"
              htmlFor={ids.headline}
              required
              hint="Shown on your public instructor profile. At least 10 characters."
              count={`${headline.trim().length} / 120`}
            >
              <Input
                id={ids.headline}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder='e.g. "Senior DeFi analyst & on-chain researcher"'
                maxLength={120}
              />
            </FormField>

            <FormField
              label="Areas of expertise"
              htmlFor={ids.expertise}
              required
              hint="Press Enter or comma to add. Up to 8."
            >
              <div className="flex gap-2.5">
                <Input
                  id={ids.expertise}
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addExpertise()
                    }
                  }}
                  placeholder="e.g. Technical Analysis"
                />
                <Button type="button" variant="outline" className={CONTROL_BUTTON} onClick={addExpertise}>
                  Add
                </Button>
              </div>
              {expertise.length > 0 && (
                <ul className="flex flex-wrap items-center gap-2 pt-1">
                  {expertise.map((tag) => (
                    <li
                      key={tag}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent pl-3 pr-1.5 text-[13px] font-medium text-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setExpertise((prev) => prev.filter((t) => t !== tag))}
                        aria-label={`Remove ${tag}`}
                        className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FormField>

            <FormField label="Years of experience" required>
              <div role="radiogroup" aria-label="Years of experience" className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-2.5">
                {EXPERIENCE_OPTIONS.map((opt) => {
                  const selected = experienceYears === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setExperienceYears(opt)}
                      className={`h-10 rounded-full border px-2 text-[13px] sm:min-w-20 sm:px-4 font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {opt} yrs
                    </button>
                  )
                })}
              </div>
            </FormField>
          </>
        )}

        {/* Step 1: experience + motivation */}
        {step === 1 && (
          <>
            <FormField
              label="Tell us about your experience"
              htmlFor={ids.experience}
              required
              hint="At least 50 characters."
              count={`${experience.trim().length} / 2000`}
            >
              <Textarea
                id={ids.experience}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Your trading or teaching background, credentials, notable work…"
                className="min-h-36"
                maxLength={2000}
              />
            </FormField>
            <FormField
              label={`Why do you want to teach on ${BRAND.name}?`}
              htmlFor={ids.motivation}
              required
              hint="At least 50 characters."
              count={`${motivation.trim().length} / 2000`}
            >
              <Textarea
                id={ids.motivation}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="What will you teach, and why are you the right person to teach it?"
                className="min-h-36"
                maxLength={2000}
              />
            </FormField>
          </>
        )}

        {/* Step 2: links */}
        {step === 2 && (
          <>
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
            <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
              <FormField label="Portfolio / work URL" htmlFor={ids.portfolio}>
                <Input
                  id={ids.portfolio}
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://…"
                />
              </FormField>
              <FormField label="LinkedIn" htmlFor={ids.linkedin}>
                <Input
                  id={ids.linkedin}
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="linkedin.com/in/…"
                />
              </FormField>
              <FormField label="Twitter / X" htmlFor={ids.twitter}>
                <Input
                  id={ids.twitter}
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="x.com/…"
                />
              </FormField>
              <FormField label="Website" htmlFor={ids.website}>
                <Input
                  id={ids.website}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                />
              </FormField>
            </div>

            {/* Terms of teaching */}
            <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border p-4 transition-colors hover:bg-accent/40">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-[13px] leading-relaxed text-muted-foreground">
                I agree to the {BRAND.name} instructor terms: original content only, 85/15 revenue share,
                refund-window clawbacks, and course quality standards.
              </span>
            </label>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-[10px] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
          {error}
        </p>
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="ghost"
          className={`${CONTROL_BUTTON} ${step === 0 ? "invisible" : ""}`}
          disabled={step === 0 || submit.isPending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          Back
        </Button>
        <div className="flex min-w-0 items-center gap-4">
          {blocker && (
            <span className="hidden truncate text-[12.5px] text-muted-foreground sm:inline">{blocker}</span>
          )}
          {step < 2 ? (
            <Button
              type="button"
              className="h-11 px-6 text-[14px] md:h-10 disabled:bg-surface-sunken disabled:text-muted-foreground disabled:opacity-100"
              disabled={!!blocker}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 px-6 text-[14px] md:h-10 disabled:bg-surface-sunken disabled:text-muted-foreground disabled:opacity-100"
              disabled={submit.isPending || !!blocker}
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
      </div>
    </section>
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
      <div className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:pb-12 md:pt-10">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-[14px] bg-primary/[0.12] text-primary">
            <HugeiconsIcon icon={Mortarboard01Icon} className="size-6" />
          </div>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            Become an instructor
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Teach crypto, trading and blockchain to thousands of WorldStreet students — and earn 85% of every
            sale.
          </p>
        </header>

        {isInstructor ? (
          <section className={`${PANEL} space-y-4 p-8 text-center`}>
            <div className="space-y-1.5">
              <p className="text-[15px] font-semibold text-foreground">You already have instructor access</p>
              <p className="text-[14px] text-muted-foreground">
                Head to your instructor portal to create and manage courses.
              </p>
            </div>
            <Button className="h-10 px-5" render={<Link href="/instructor" />}>
              Open Instructor Portal
            </Button>
          </section>
        ) : isLoading ? (
          <Skeleton className="h-96 rounded-[20px]" />
        ) : isActive && application ? (
          <section className={`${PANEL} space-y-6 p-6 sm:p-8`}>
            <StatusTracker status={application.status} />
            <div className="rounded-[14px] bg-surface-sunken px-4 py-3.5">
              <p className="text-[14px] font-medium text-foreground">{application.answers.headline}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
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
              <div className="space-y-3 rounded-[14px] border border-primary/25 bg-primary/5 p-4">
                <div className="space-y-1">
                  <p className="text-[14px] font-semibold text-foreground">Pick your interview time</p>
                  <p className="text-[13px] text-muted-foreground">
                    Our team proposed {application.proposedSlots.length} time
                    {application.proposedSlots.length === 1 ? "" : "s"} — choose what works for you.
                  </p>
                </div>
                <div className="space-y-2">
                  {application.proposedSlots.map((slot) => (
                    <button
                      key={slot.at}
                      type="button"
                      disabled={pickSlot.isPending}
                      onClick={() => pickSlot.mutate(slot.at)}
                      className="flex h-12 w-full items-center justify-between gap-3 rounded-[12px] border border-border bg-background px-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    >
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {new Date(slot.at).toLocaleString("en-US", {
                          dateStyle: "full",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-primary">
                        {pickSlot.isPending ? "Confirming…" : "Choose"}
                      </span>
                    </button>
                  ))}
                </div>
                {slotError && <p className="text-[13px] text-destructive">{slotError}</p>}
              </div>
            )}
            {application.status === "interview_scheduled" && application.interview && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-primary/25 bg-primary/5 p-4">
                <div className="space-y-1">
                  <p className="text-[14px] font-semibold text-foreground">Your interview call</p>
                  <p className="text-[13px] text-muted-foreground">
                    {application.interview.scheduledAt
                      ? new Date(application.interview.scheduledAt).toLocaleString("en-US", {
                          dateStyle: "full",
                          timeStyle: "short",
                        })
                      : "Time to be confirmed"}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    Join at the scheduled time — you&apos;ll be admitted from the waiting room.
                  </p>
                </div>
                <Button className="h-10 px-5" render={<Link href={application.interview.joinPath} />}>
                  Join interview
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
              <p className="text-[13px] text-muted-foreground">We&apos;ll notify you by email and in the app.</p>
              <Button variant="ghost" className="h-9 px-3 text-[13px] text-muted-foreground" onClick={() => setWithdrawOpen(true)}>
                Withdraw
              </Button>
            </div>
          </section>
        ) : isRejected && application ? (
          <section className={`${PANEL} space-y-4 p-8 text-center`}>
            <p className="text-[15px] font-semibold text-foreground">Your application wasn&apos;t approved</p>
            {application.decisionNote && (
              <p className="mx-auto max-w-sm border-l-2 border-border pl-3 text-left text-[14px] text-muted-foreground">
                {application.decisionNote}
              </p>
            )}
            <p className="text-[14px] text-muted-foreground">You&apos;re welcome to apply again with more detail.</p>
            <Button variant="outline" className="h-10 px-5" onClick={() => setReapplying(true)}>
              Apply again
            </Button>
          </section>
        ) : showForm ? (
          <ApplicationForm onSubmitted={refresh} />
        ) : null}

        {/* How it works */}
        {!isInstructor && (
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              { step: "1", title: "Apply", body: "Tell us about your expertise and what you'll teach." },
              { step: "2", title: "Interview", body: "Our team reviews and may invite you to a short call." },
              { step: "3", title: "Teach & earn", body: "Publish courses and earn 85% of every sale." },
            ].map((item) => (
              <li key={item.step} className={`${PANEL} p-5`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                  Step {item.step}
                </span>
                <p className="mt-2 text-[15px] font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Withdraw confirm */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw your application?</DialogTitle>
            <DialogDescription>Your application will be closed. You can apply again any time.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
              {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
