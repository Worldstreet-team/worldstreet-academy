"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { CheckIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getMyCountry, updateMyCountry } from "@/lib/actions/profile"
import { countryOptions } from "@/lib/countries"
import { BRAND } from "@/lib/brand"

/**
 * The student's country (spec §14): shown next to their name when one of their
 * reviews appears in the homepage testimonials. Saves on selection.
 *
 * `countryOptions()` is Phase 5's (`lib/countries.ts`) — same sorted
 * value/label list the faculty editor uses, not reimplemented here. Its own
 * doc comment prefers a server-computed call (Node's ICU data can name a
 * country slightly differently from the browser's); calling it client-side
 * here is a deliberate, cosmetic-risk-only exception so this card stays a
 * self-contained, prop-free component.
 */
export function CountryCard() {
  const [country, setCountry] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const items = useMemo(() => countryOptions(), [])

  useEffect(() => {
    getMyCountry().then((code) => {
      setCountry(code)
      setLoaded(true)
    })
  }, [])

  function save(next: string | null) {
    const previous = country
    setCountry(next)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await updateMyCountry(next)
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
