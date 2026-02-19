"use client"

import { useState, useCallback, useMemo, useTransition, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { languages, getLanguage, type Language } from "./languages"
import { changeLanguage, resetToEnglish } from "./translate-script"
import { updatePreferredLanguage } from "@/lib/actions/language"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Cancel01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons"

type LanguagePickerProps = {
  defaultLanguage?: string | null
  /** Render function for trigger button — receives current language and open state */
  children?: (props: {
    currentLanguage: Language
    isTranslating: boolean
  }) => React.ReactNode
}

export function LanguagePicker({ defaultLanguage, children }: LanguagePickerProps) {
  const isMobile = useIsMobile()
  const [currentCode, setCurrentCode] = useState(defaultLanguage || "en")
  const [isTranslating, setIsTranslating] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [, startTransition] = useTransition()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const currentLanguage = getLanguage(currentCode)

  // Filtered languages based on search
  const filtered = useMemo(() => {
    if (!search.trim()) return languages
    const q = search.toLowerCase().trim()
    return languages.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    )
  }, [search])

  // Popular languages to show at top when no search
  const popular = useMemo(
    () =>
      ["en", "es", "fr", "de", "pt", "zh-CN", "ar", "hi", "ja", "ko", "ru", "tr"]
        .map((c) => getLanguage(c))
        .filter(Boolean),
    []
  )

  const handleSelect = useCallback(
    async (lang: Language) => {
      setIsTranslating(true)
      setSearch("")

      try {
        if (lang.code === "en") {
          await resetToEnglish()
        } else {
          await changeLanguage(lang.code)
        }
        setCurrentCode(lang.code)

        // Persist to DB in background
        startTransition(() => {
          updatePreferredLanguage(lang.code)
        })
      } catch {
        // Silently fail — translation may partially work
      } finally {
        setIsTranslating(false)
        setOpen(false)
      }
    },
    []
  )

  // Focus search input when popover/sheet opens
  useEffect(() => {
    if (open) {
      // Small delay to let the popover/sheet render
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
    setSearch("")
  }, [open])

  const pickerContent = (
    <div className="flex flex-col">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search languages..."
            className="pl-8 pr-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Language list — explicit max-h so ScrollArea actually scrolls */}
      <ScrollArea className="max-h-65">
        <div className="px-1.5 pb-2">
          {/* Popular section — only when not searching */}
          {!search.trim() && (
            <>
              <div className="px-2 pt-1 pb-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Popular
                </span>
              </div>
              <div className="space-y-0.5 px-0.5">
                {popular.map((lang) => (
                  <LanguageItem
                    key={lang.code}
                    lang={lang}
                    isSelected={lang.code === currentCode}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
              <div className="my-2 mx-2 border-t border-border/50" />
              <div className="px-2 pb-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  All languages
                </span>
              </div>
            </>
          )}

          {/* Filtered list or all */}
          <div className="space-y-0.5 px-0.5">
            {filtered.length > 0 ? (
              filtered.map((lang) => (
                <LanguageItem
                  key={lang.code}
                  lang={lang}
                  isSelected={lang.code === currentCode}
                  onSelect={handleSelect}
                />
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No languages found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try a different search term
                </p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer — current language + inline loading indicator */}
      <div className="border-t px-3 py-2.5 flex items-center gap-2 bg-muted/30">
        {isTranslating ? (
          <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        ) : (
          <span className="text-base leading-none notranslate shrink-0" translate="no">{currentLanguage.flag}</span>
        )}
        <span className="text-xs text-muted-foreground truncate notranslate" translate="no">
          {isTranslating ? "Applying…" : currentLanguage.name}
        </span>
      </div>
    </div>
  )

  const triggerButton = children
    ? children({ currentLanguage, isTranslating })
    : (
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted transition-colors"
        >
          <span className="text-sm leading-none notranslate" translate="no">{currentLanguage.flag}</span>
        </button>
      )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!isTranslating) setOpen(o) }}>
        <SheetTrigger render={<div className="w-full" />}>
          {triggerButton}
        </SheetTrigger>
        <SheetContent side="bottom" showCloseButton={false} className="px-0 pb-0 rounded-t-2xl">
          <SheetHeader className="px-4 pb-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-semibold">Language</SheetTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isTranslating}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted text-muted-foreground disabled:opacity-40"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
              </button>
            </div>
          </SheetHeader>
          {pickerContent}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={(o) => { if (!isTranslating) setOpen(o) }}>
      <PopoverTrigger render={<div />}>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-75 p-0 overflow-hidden"
      >
        <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Language</h3>
        </div>
        {pickerContent}
      </PopoverContent>
    </Popover>
  )
}

/** Single language item row */
function LanguageItem({
  lang,
  isSelected,
  onSelect,
}: {
  lang: Language
  isSelected: boolean
  onSelect: (lang: Language) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(lang)}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
        isSelected
          ? "bg-muted text-foreground"
          : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <span className="text-lg leading-none notranslate shrink-0" translate="no">
        {lang.flag}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium truncate block notranslate" translate="no">
          {lang.name}
        </span>
        <span className="text-[11px] text-muted-foreground truncate block notranslate" translate="no">
          {lang.nativeName}
        </span>
      </div>
      {isSelected && (
        <HugeiconsIcon
          icon={Tick01Icon}
          size={14}
          className="text-foreground/50 shrink-0"
          strokeWidth={2.5}
        />
      )}
    </button>
  )
}
