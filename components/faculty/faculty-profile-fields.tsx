"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CountryOption } from "@/lib/countries"
import { FACULTY_LIMITS, type FacultyProfileForm } from "@/lib/faculty"

/** Select value for "no country" — Base UI items need a string key. */
const NO_COUNTRY = "none"

const LINK_FIELDS = [
  { key: "website", label: "Website", placeholder: "https://your-site.com" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "twitter", label: "X (Twitter)", placeholder: "x.com/you" },
] as const

/**
 * The spec §10 faculty fields as one controlled block. The instructor's own
 * editor (/instructor/profile) and the admin dialog (/admin/users) render
 * exactly these fields against the same limits; the server re-validates with
 * `FacultyProfileSchema`. Name and photo stay in the owner's account card.
 */
export function FacultyProfileFields({
  value,
  onChange,
  countries,
  idPrefix,
  disabled = false,
}: {
  value: FacultyProfileForm
  onChange: (next: FacultyProfileForm) => void
  /** From `countryOptions()` — computed on the server wherever this block is server-rendered. */
  countries: CountryOption[]
  /** Prefix for input ids, so labels stay unique on the page. */
  idPrefix: string
  disabled?: boolean
}) {
  const [expertiseDraft, setExpertiseDraft] = useState("")
  const [credentialDraft, setCredentialDraft] = useState("")
  const id = (name: string) => `${idPrefix}-${name}`
  const countryItems = [{ value: NO_COUNTRY, label: "Not shown" }, ...countries]
  const expertiseFull = value.expertise.length >= FACULTY_LIMITS.expertiseItems
  const credentialsFull = value.credentials.length >= FACULTY_LIMITS.credentialItems

  function patch(next: Partial<FacultyProfileForm>) {
    onChange({ ...value, ...next })
  }

  function addExpertise() {
    const tag = expertiseDraft.trim().slice(0, FACULTY_LIMITS.expertiseItem)
    if (tag && !value.expertise.includes(tag) && !expertiseFull) {
      patch({ expertise: [...value.expertise, tag] })
    }
    setExpertiseDraft("")
  }

  function addCredential() {
    const item = credentialDraft.trim().slice(0, FACULTY_LIMITS.credentialItem)
    if (item && !value.credentials.includes(item) && !credentialsFull) {
      patch({ credentials: [...value.credentials, item] })
    }
    setCredentialDraft("")
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={id("headline")}>Headline</Label>
        <Input
          id={id("headline")}
          value={value.headline}
          onChange={(e) => patch({ headline: e.target.value })}
          maxLength={FACULTY_LIMITS.headline}
          placeholder="e.g. Forex educator and former bank dealer"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("specialization")}>Area of specialization</Label>
        <Input
          id={id("specialization")}
          value={value.specialization}
          onChange={(e) => patch({ specialization: e.target.value })}
          maxLength={FACULTY_LIMITS.specialization}
          placeholder="e.g. Risk management for retail traders"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id("bio")}>Short biography</Label>
          <span className="text-[11px] tabular-nums text-ws-subtle">
            {value.bio.length.toLocaleString("en-US")} / {FACULTY_LIMITS.bio.toLocaleString("en-US")}
          </span>
        </div>
        <Textarea
          id={id("bio")}
          value={value.bio}
          onChange={(e) => patch({ bio: e.target.value })}
          maxLength={FACULTY_LIMITS.bio}
          className="min-h-24"
          placeholder="Who you are and what you teach, in a few sentences."
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id("experience")}>Professional experience</Label>
          <span className="text-[11px] tabular-nums text-ws-subtle">
            {value.experience.length.toLocaleString("en-US")} / {FACULTY_LIMITS.experience.toLocaleString("en-US")}
          </span>
        </div>
        <Textarea
          id={id("experience")}
          value={value.experience}
          onChange={(e) => patch({ experience: e.target.value })}
          maxLength={FACULTY_LIMITS.experience}
          className="min-h-32"
          placeholder="Roles, years in the field and the work you have done."
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("expertise")}>Areas of expertise</Label>
        <div className="flex gap-2">
          <Input
            id={id("expertise")}
            value={expertiseDraft}
            onChange={(e) => setExpertiseDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addExpertise()
              }
            }}
            maxLength={FACULTY_LIMITS.expertiseItem}
            placeholder={expertiseFull ? "Limit reached" : "e.g. Technical analysis — press Enter"}
            disabled={disabled || expertiseFull}
          />
          <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={addExpertise} disabled={disabled || expertiseFull}>
            <PlusIcon size={14} aria-hidden />
            Add
          </Button>
        </div>
        {value.expertise.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {value.expertise.map((tag) => (
              <li
                key={tag}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-ws-chip py-0.5 pl-2.5 pr-1 text-[12px] text-ws-primary"
              >
                <span className="truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() => patch({ expertise: value.expertise.filter((t) => t !== tag) })}
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
                >
                  <XIcon size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-ws-subtle">Up to {FACULTY_LIMITS.expertiseItems}.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("credentials")}>Credentials &amp; achievements</Label>
        <div className="flex gap-2">
          <Input
            id={id("credentials")}
            value={credentialDraft}
            onChange={(e) => setCredentialDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCredential()
              }
            }}
            maxLength={FACULTY_LIMITS.credentialItem}
            placeholder={credentialsFull ? "Limit reached" : "e.g. a certification or award — press Enter"}
            disabled={disabled || credentialsFull}
          />
          <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={addCredential} disabled={disabled || credentialsFull}>
            <PlusIcon size={14} aria-hidden />
            Add
          </Button>
        </div>
        {value.credentials.length > 0 && (
          <ul className="rounded-md border border-ws-hairline">
            {value.credentials.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 border-t border-ws-hairline px-3 py-2 text-[13px] text-ws-primary first:border-t-0"
              >
                <span className="min-w-0 flex-1 break-words">{item}</span>
                <button
                  type="button"
                  onClick={() => patch({ credentials: value.credentials.filter((c) => c !== item) })}
                  aria-label={`Remove ${item}`}
                  disabled={disabled}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
                >
                  <XIcon size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-ws-subtle">Up to {FACULTY_LIMITS.credentialItems}.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("country")}>Country</Label>
        <Select
          items={countryItems}
          value={value.country ?? NO_COUNTRY}
          onValueChange={(v) => patch({ country: v && v !== NO_COUNTRY ? v : null })}
          disabled={disabled}
        >
          <SelectTrigger id={id("country")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {countryItems.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-ws-primary">Links</legend>
        {LINK_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={id(field.key)}>{field.label}</Label>
            <Input
              id={id(field.key)}
              inputMode="url"
              autoComplete="url"
              value={value.socialLinks[field.key]}
              onChange={(e) => patch({ socialLinks: { ...value.socialLinks, [field.key]: e.target.value } })}
              maxLength={FACULTY_LIMITS.link}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          </div>
        ))}
      </fieldset>
    </div>
  )
}
