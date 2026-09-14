"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react"
import { CheckIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getMyCountry, updateMyCountry } from "@/lib/actions/profile"
import { countryOptions } from "@/lib/countries"
import { BRAND } from "@/lib/brand"

const noSubscribe = () => () => {}

/**
 * The student's country (spec §14): shown next to their name when one of their
 * reviews appears in the homepage testimonials. Saves on selection.
 *
 * `countryOptions()` is Phase 5's (`lib/countries.ts`) — same sorted
 * value/label list the faculty editor uses, not reimplemented here. The profile
 * page is a client component, so the labels can't be computed on the server and
 * passed down; they are built only after mount instead (Phase 5 ruling 16) — the
 * browser's ICU data can name a country differently from Node's, so labels in
 * the server render would mismatch on hydration.
 */
export function CountryCard() {
  const [country, setCountry] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const latestRequest = useRef(0)

  // false on the server and during hydration, true once mounted in the browser.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false)
  const items = useMemo(() => (mounted ? countryOptions() : []), [mounted])

  useEffect(() => {
    getMyCountry()
      .then((code) => {
        setCountry(code)
        setLoaded(true)
      })
      .catch(() => {
        setError("Couldn't load your country — reload to try again")
        setLoaded(true)
      })
  }, [])

  function save(next: string | null) {
    const request = ++latestRequest.current
    const previous = country
    setCountry(next)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await updateMyCountry(next)
      // A newer selection supersedes this one: only the latest request updates state.
      if (request !== latestRequest.current) return
      if (result.success) {
        setSaved(true)
      } else {
        setCountry(previous)
        setError(result.error)
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Country</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown next to your name when your review appears on the {BRAND.name} homepage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            items={items}
            value={country}
            onValueChange={(value) => save((value as string | null) ?? null)}
            disabled={!loaded || isPending}
          >
            <SelectTrigger className="w-full sm:w-72" aria-label="Country">
              <SelectValue placeholder={loaded ? "Choose your country" : "Loading…"} />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {country && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => save(null)}>
              Remove
            </Button>
          )}
          {saved && !isPending && (
            <p className="text-xs text-ws-success flex items-center gap-1">
              <CheckIcon size={14} />
              Saved
            </p>
          )}
        </div>
        {error && <p className="text-xs text-ws-danger">{error}</p>}
      </CardContent>
    </Card>
  )
}
