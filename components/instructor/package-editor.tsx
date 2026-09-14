"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ICoursePackage, IPackageEntitlements, PackageKey } from "@/lib/db/models"
import { PACKAGE_KEYS, PACKAGE_LABEL } from "@/lib/entitlements"
import { PlusIcon, Trash2Icon } from "lucide-react"

/**
 * Editor-side row for one package. Mirrors ICoursePackage except that
 * `features` is edited as one textarea (a line per feature) and `price` is
 * the raw input string; `toCoursePackage` converts back before submit.
 * `uid` is the React key (the tier key can be changed in place).
 */
export type EditorPackage = {
  uid: string
  key: PackageKey
  name: string
  tagline: string
  price: string
  featuresText: string
  highlight: boolean
  ctaLabel: string
  enabled: boolean
  entitlements: IPackageEntitlements
}

const NO_ENTITLEMENTS: IPackageEntitlements = {
  liveClasses: false,
  instructorQa: false,
  assignments: false,
  certificate: false,
  mentorship: false,
  prioritySupport: false,
}

const TIER_ITEMS = PACKAGE_KEYS.map((k) => ({ value: k, label: PACKAGE_LABEL[k] }))

const ENTITLEMENT_LABELS: ReadonlyArray<{ key: keyof IPackageEntitlements; label: string }> = [
  { key: "liveClasses", label: "Live classes" },
  { key: "instructorQa", label: "Instructor Q&A" },
  { key: "assignments", label: "Practical assignments" },
  { key: "certificate", label: "Certificate" },
  { key: "mentorship", label: "Mentorship" },
  { key: "prioritySupport", label: "Priority support" },
]

/** Existing rows key on the tier (unique per course) so server and client render the same keys. */
export function toEditorPackage(p: ICoursePackage): EditorPackage {
  return {
    uid: p.key,
    key: p.key,
    name: p.name,
    tagline: p.tagline ?? "",
    price: String(p.price),
    featuresText: (p.features ?? []).join("\n"),
    highlight: Boolean(p.highlight),
    ctaLabel: p.ctaLabel ?? "",
    enabled: p.enabled !== false,
    entitlements: { ...NO_ENTITLEMENTS, ...p.entitlements },
  }
}

/** "" or non-numeric → null. No rounding or clamping: the server rejects null, decimals and negatives with a message. */
function parsePrice(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** What the editor posts: an ICoursePackage whose price may still be invalid (null) — the server is the authority. */
export type PackagePayload = Omit<ICoursePackage, "price"> & { price: number | null }

export function toCoursePackage(p: EditorPackage): PackagePayload {
  const ctaLabel = p.ctaLabel.trim()
  return {
    key: p.key,
    name: p.name.trim(),
    tagline: p.tagline.trim(),
    price: parsePrice(p.price),
    features: p.featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    highlight: p.highlight,
    ctaLabel: ctaLabel === "" ? null : ctaLabel,
    enabled: p.enabled,
    entitlements: { ...p.entitlements },
  }
}

export function emptyPackage(key: PackageKey): EditorPackage {
  return {
    uid: crypto.randomUUID(),
    key,
    name: "",
    tagline: "",
    price: "",
    featuresText: "",
    highlight: false,
    ctaLabel: "",
    enabled: true,
    entitlements: { ...NO_ENTITLEMENTS },
  }
}

/** Cheapest ENABLED tier in whole dollars, or null when no tier is enabled (the course then sells at its own price). */
export function ladderPrice(packages: EditorPackage[]): number | null {
  const prices = packages
    .filter((p) => p.enabled)
    .map((p) => parsePrice(p.price))
    .filter((n): n is number => n !== null)
  return prices.length === 0 ? null : Math.min(...prices)
}

/**
 * Up to three tiers keyed basic / standard / executive. Controlled: the
 * course editor owns the array and serializes it into the `packages` hidden
 * field. Server rules mirrored here for a good first try — unique keys (used
 * keys are disabled in the select), at most one highlight (turning one on
 * turns the others off) — the server (`parsePackages`) remains the authority.
 */
export function PackageEditor({
  value,
  onChange,
  error,
}: {
  value: EditorPackage[]
  onChange: (next: EditorPackage[]) => void
  error?: string
}) {
  const used = new Set(value.map((p) => p.key))
  const nextKey = PACKAGE_KEYS.find((k) => !used.has(k)) ?? null

  function patch(uid: string, changes: Partial<EditorPackage>) {
    onChange(value.map((p) => (p.uid === uid ? { ...p, ...changes } : p)))
  }
  function setHighlight(uid: string, on: boolean) {
    onChange(value.map((p) => ({ ...p, highlight: p.uid === uid ? on : on ? false : p.highlight })))
  }
  function setEntitlement(uid: string, key: keyof IPackageEntitlements, on: boolean) {
    onChange(
      value.map((p) => (p.uid === uid ? { ...p, entitlements: { ...p.entitlements, [key]: on } } : p))
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        Up to three tiers — Basic, Standard and Executive 101. While any tier is enabled the
        course sells from the cheapest enabled tier and the Pricing section below follows it.
      </p>

      {value.map((pkg) => (
        <div key={pkg.uid} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Select
              items={TIER_ITEMS}
              value={pkg.key}
              onValueChange={(v) => {
                if (v) patch(pkg.uid, { key: v as PackageKey })
              }}
            >
              <SelectTrigger className="w-[9.5rem]" aria-label="Package tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PACKAGE_KEYS.map((k) => (
                  <SelectItem key={k} value={k} disabled={k !== pkg.key && used.has(k)}>
                    {PACKAGE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <Switch
                checked={pkg.enabled}
                onCheckedChange={(v) => patch(pkg.uid, { enabled: Boolean(v) })}
                aria-label="Package enabled"
              />
              {pkg.enabled ? "Enabled" : "Disabled"}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${PACKAGE_LABEL[pkg.key]} package`}
              onClick={() => onChange(value.filter((p) => p.uid !== pkg.uid))}
            >
              <Trash2Icon size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`pkg-name-${pkg.uid}`}>Name</Label>
              <Input
                id={`pkg-name-${pkg.uid}`}
                placeholder="Forex Foundation"
                maxLength={60}
                value={pkg.name}
                onChange={(e) => patch(pkg.uid, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pkg-price-${pkg.uid}`}>Price (USD)</Label>
              <Input
                id={`pkg-price-${pkg.uid}`}
                type="number"
                min="0"
                step="1"
                placeholder="49"
                value={pkg.price}
                onChange={(e) => patch(pkg.uid, { price: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">Required. Enter 0 only when this is the program&apos;s single package.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`pkg-tagline-${pkg.uid}`}>Tagline</Label>
            <Input
              id={`pkg-tagline-${pkg.uid}`}
              placeholder="Perfect for beginners"
              maxLength={120}
              value={pkg.tagline}
              onChange={(e) => patch(pkg.uid, { tagline: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`pkg-features-${pkg.uid}`}>
              Features <span className="font-normal text-muted-foreground">— one per line, up to 20</span>
            </Label>
            <Textarea
              id={`pkg-features-${pkg.uid}`}
              className="min-h-24"
              placeholder={"Forex fundamentals\nCurrency pairs"}
              value={pkg.featuresText}
              onChange={(e) => patch(pkg.uid, { featuresText: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`pkg-cta-${pkg.uid}`}>
              Button label{" "}
              <span className="font-normal text-muted-foreground">— optional, defaults to “Enrol for $price”</span>
            </Label>
            <Input
              id={`pkg-cta-${pkg.uid}`}
              placeholder="Apply / Enrol for $999"
              maxLength={40}
              value={pkg.ctaLabel}
              onChange={(e) => patch(pkg.uid, { ctaLabel: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Most popular</p>
              <p className="text-[10px] text-muted-foreground">
                Highlights this tier on the program page. One per course.
              </p>
            </div>
            <Switch
              checked={pkg.highlight}
              onCheckedChange={(v) => setHighlight(pkg.uid, Boolean(v))}
              aria-label="Most popular"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-medium uppercase tracking-wider text-ws-muted">Includes</legend>
            <div className="grid grid-cols-2 gap-2">
              {ENTITLEMENT_LABELS.map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={pkg.entitlements[key]}
                    onCheckedChange={(v) => setEntitlement(pkg.uid, key, Boolean(v))}
                  />
                  <span className="text-[12px]">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        disabled={nextKey === null}
        onClick={() => {
          if (nextKey) onChange([...value, emptyPackage(nextKey)])
        }}
      >
        <PlusIcon size={14} />
        {nextKey ? `Add ${PACKAGE_LABEL[nextKey]} package` : "All three tiers added"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
