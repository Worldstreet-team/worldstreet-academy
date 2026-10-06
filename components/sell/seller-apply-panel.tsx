"use client"
import { Glyph, CheckmarkCircle02Icon, Clock01Icon, Store01Icon } from "@/components/icons"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"


import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  submitSellerApplication,
  type MySellerApplication,
  type SellerApplicationInput,
} from "@/lib/actions/seller-applications"
import { SCHOOLS, SCHOOL_BY_SLUG, type SchoolSlug } from "@/lib/schools"
import { QUALITY_CRITERIA, SELLER_HOME } from "@/lib/marketplace"

/* The student shell's v2 surfaces (as on /dashboard/become-instructor). */
const PANEL = "rounded-[20px] border border-ws-hairline bg-card dark:border-transparent"

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" })
}

function Field({
  label,
  htmlFor,
  hint,
  count,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: React.ReactNode
  count?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        <span className="text-destructive" aria-hidden>
          *
        </span>
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

function StatusPanel({
  icon,
  title,
  children,
  action,
}: {
  icon: typeof Store01Icon
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className={`${PANEL} space-y-4 p-6 text-center sm:p-8`}>
      <div className="mx-auto flex size-11 items-center justify-center rounded-[12px] bg-primary/[0.12] text-primary">
        <Glyph icon={icon} className="size-5" />
      </div>
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <div className="text-[14px] leading-relaxed text-muted-foreground">{children}</div>
      </div>
      {action}
    </section>
  )
}

function ApplicationForm({
  defaultName,
  splitNote,
  onSubmitted,
}: {
  defaultName: string
  splitNote: string
  onSubmitted: () => void
}) {
  const ids = {
    name: React.useId(),
    topic: React.useId(),
    experience: React.useId(),
    sample: React.useId(),
    pitch: React.useId(),
    agree: React.useId(),
  }
  const [fullName, setFullName] = React.useState(defaultName)
  const [school, setSchool] = React.useState<SchoolSlug | "">("")
  const [topic, setTopic] = React.useState("")
  const [experience, setExperience] = React.useState("")
  const [sampleUrl, setSampleUrl] = React.useState("")
  const [pitch, setPitch] = React.useState("")
  const [agreed, setAgreed] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const schoolItems = SCHOOLS.map((s) => ({ value: s.slug, label: s.name }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // The server validates everything; "" for the school gets its own message.
    const input: SellerApplicationInput = { fullName, school, topic, experience, sampleUrl, pitch, agreed }
    startTransition(async () => {
      const res = await submitSellerApplication(input)
      if (!res.success) {
        setError(res.error)
        return
      }
      onSubmitted()
    })
  }

  return (
    <form onSubmit={submit} className={`${PANEL} space-y-6 p-6 sm:p-8`} noValidate>
      <div className="space-y-1">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-foreground">Your application</h2>
        <p className="text-[14px] text-muted-foreground">An admin reads every application. We&apos;ll email you the decision.</p>
      </div>

      <Field label="Your full name" htmlFor={ids.name} hint="The name on your course cards: “by …”.">
        <Input id={ids.name} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="School" hint="Where your course fits.">
          <Select items={schoolItems} value={school || null} onValueChange={(v) => setSchool((v ?? "") as SchoolSlug | "")}>
            <SelectTrigger className="w-full" aria-label="School">
              <SelectValue placeholder="Choose a school" />
            </SelectTrigger>
            <SelectContent>
              {SCHOOLS.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="What you'll teach" htmlFor={ids.topic} hint="A topic, in a few words.">
          <Input
            id={ids.topic}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Price action for beginners"
            maxLength={160}
          />
        </Field>
      </div>

      <Field
        label="Your experience"
        htmlFor={ids.experience}
        hint="What you've done in this field, and any teaching. At least 50 characters."
        count={`${experience.trim().length} / 2000`}
      >
        <Textarea
          id={ids.experience}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className="min-h-32"
          maxLength={2000}
        />
      </Field>

      <Field
        label="A sample of your teaching"
        htmlFor={ids.sample}
        hint="A video, a channel, a course you sell elsewhere — anything that shows how you teach."
      >
        <Input
          id={ids.sample}
          type="url"
          inputMode="url"
          value={sampleUrl}
          onChange={(e) => setSampleUrl(e.target.value)}
          placeholder="https://"
          maxLength={500}
        />
      </Field>

      <Field
        label="Why should learners buy your course?"
        htmlFor={ids.pitch}
        hint="What they'll be able to do afterwards, in your words. At least 50 characters."
        count={`${pitch.trim().length} / 2000`}
      >
        <Textarea
          id={ids.pitch}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          className="min-h-32"
          maxLength={2000}
        />
      </Field>

      <div className="space-y-3 rounded-[14px] bg-surface-sunken p-4">
        <p className="text-[13px] font-semibold text-foreground">Every course is reviewed against these standards</p>
        <ul className="space-y-1.5">
          {QUALITY_CRITERIA.map((c) => (
            <li key={c.title} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
              <Glyph icon={CheckmarkCircle02Icon} className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">{c.title}.</span> {c.body}
              </span>
            </li>
          ))}
        </ul>
        <label htmlFor={ids.agree} className="flex cursor-pointer items-start gap-3 border-t border-border pt-3">
          <Checkbox id={ids.agree} checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} className="mt-0.5" />
          <span className="text-[13px] leading-relaxed text-foreground">
            I agree to the quality standards and the revenue split. {splitNote}
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" className="h-11 px-6 md:h-10" disabled={pending}>
          {pending ? "Sending…" : "Apply to sell"}
        </Button>
      </div>
    </form>
  )
}

/**
 * The seller application at /dashboard/sell/apply (owner, 2026-10-05): the
 * form, or where an application stands — in review, approved (the way into
 * the seller area) or not approved (the reason, and Apply again). Faculty
 * don't apply: they can already put courses on the marketplace.
 */
export function SellerApplyPanel({
  data,
  defaultName,
  splitNote,
}: {
  data: MySellerApplication
  defaultName: string
  splitNote: string
}) {
  const router = useRouter()
  const [reapplying, setReapplying] = React.useState(false)
  const app = data.application

  if (data.isFaculty) {
    return (
      <StatusPanel
        icon={Store01Icon}
        title="You can already sell"
        action={
          <Button className="h-10 px-5" render={<Link href="/instructor/courses/new" />}>
            Create a marketplace course
          </Button>
        }
      >
        Faculty put courses on the marketplace straight from the course editor — choose &ldquo;Marketplace
        course&rdquo; as the course type.
      </StatusPanel>
    )
  }

  if (data.sellerStatus === "approved") {
    return (
      <StatusPanel
        icon={CheckmarkCircle02Icon}
        title="You're approved to sell"
        action={
          <Button className="h-10 px-5" render={<Link href={SELLER_HOME} />}>
            Open your seller area
          </Button>
        }
      >
        Create your course, add your lessons and submit it for review. {splitNote}
      </StatusPanel>
    )
  }

  if (app?.status === "submitted") {
    return (
      <StatusPanel icon={Clock01Icon} title="Your application is in review">
        <p>
          Submitted {formatDay(app.createdAt)} · {app.topic}
          {app.school ? ` · ${SCHOOL_BY_SLUG[app.school].short}` : ""}
        </p>
        <p className="mt-2">We&apos;ll email you and let you know here as soon as an admin decides.</p>
      </StatusPanel>
    )
  }

  if (app?.status === "rejected" && !reapplying) {
    return (
      <StatusPanel
        icon={Store01Icon}
        title="Your application wasn't approved"
        action={
          <Button variant="outline" className="h-10 px-5" onClick={() => setReapplying(true)}>
            Apply again
          </Button>
        }
      >
        {app.reason && (
          <p className="mx-auto max-w-sm border-l-2 border-border pl-3 text-left">{app.reason}</p>
        )}
        <p className="mt-3">You&apos;re welcome to apply again with more detail.</p>
      </StatusPanel>
    )
  }

  return <ApplicationForm defaultName={defaultName} splitNote={splitNote} onSubmitted={() => router.refresh()} />
}
