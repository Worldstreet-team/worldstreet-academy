"use client"

import { useState, useCallback, useMemo, useTransition, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { languages, getLanguage, type Language } from "./languages"
import { changeLanguage, resetToEnglish } from "./translate-script"
import { updatePreferredLanguage } from "@/lib/actions/language"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
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
  LanguageSkillIcon,
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
      if (lang.code === currentCode) {
        setOpen(false)
        return
      }

      setIsTranslating(true)
      setOpen(false)
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
      }
    },
    [currentCode]
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
    <div className="flex flex-col h-full max-h-[min(70vh,480px)] md:max-h-105">
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

      {/* Language list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-1.5 pb-2">
          {/* Popular section — only when not searching */}
          {!search.trim() && (
            <>
              <div className="px-2 pt-1 pb-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Popular
                </span>
              </div>
              <div className="grid grid-cols-2 gap-0.5 px-0.5">
                {popular.map((lang) => (
                  <LanguageItem
                    key={lang.code}
                    lang={lang}
                    isSelected={lang.code === currentCode}
                    onSelect={handleSelect}
                    compact
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

      {/* Current selection footer */}
      <div className="border-t px-3 py-2 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none notranslate" translate="no">{currentLanguage.flag}</span>
          <span className="text-xs font-medium text-foreground truncate notranslate" translate="no">
            {currentLanguage.name}
          </span>
        </div>
        {currentCode !== "en" && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => handleSelect(getLanguage("en"))}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  )

  const triggerButton = children ? (
    children({ currentLanguage, isTranslating })
  ) : (
    <DefaultTrigger
      currentLanguage={currentLanguage}
      isTranslating={isTranslating}
    />
  )

  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<div className="w-full" />}>
            {triggerButton}
          </SheetTrigger>
          <SheetContent side="bottom" showCloseButton={false} className="px-0 pb-0 rounded-t-2xl max-h-[85vh]">
            <SheetHeader className="px-4 pb-0">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-sm font-semibold">Language</SheetTitle>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} />
                </button>
              </div>
            </SheetHeader>
            {pickerContent}
          </SheetContent>
        </Sheet>

        {/* Translation overlay */}
        <TranslateOverlay isTranslating={isTranslating} language={currentLanguage} />
      </>
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<div />}>
          {triggerButton}
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={12}
          className="w-[320px] p-0 overflow-hidden"
        >
          <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Language</h3>
          </div>
          {pickerContent}
        </PopoverContent>
      </Popover>

      {/* Translation overlay */}
      <TranslateOverlay isTranslating={isTranslating} language={currentLanguage} />
    </>
  )
}

/** Single language item row */
function LanguageItem({
  lang,
  isSelected,
  onSelect,
  compact = false,
}: {
  lang: Language
  isSelected: boolean
  onSelect: (lang: Language) => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(lang)}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md px-2 text-left transition-colors",
        compact ? "py-1.5" : "py-2",
        isSelected
          ? "bg-primary/5 text-foreground"
          : "text-foreground/80 hover:bg-muted/80 hover:text-foreground"
      )}
    >
      <span className={cn("leading-none notranslate", compact ? "text-base" : "text-lg")} translate="no">
        {lang.flag}
      </span>
      <div className="flex-1 min-w-0">
        <span className={cn("font-medium truncate block notranslate", compact ? "text-xs" : "text-[13px]")} translate="no">
          {lang.name}
        </span>
        {!compact && (
          <span className="text-[11px] text-muted-foreground truncate block notranslate" translate="no">
            {lang.nativeName}
          </span>
        )}
      </div>
      {isSelected && (
        <HugeiconsIcon
          icon={Tick01Icon}
          size={14}
          className="text-primary shrink-0"
          strokeWidth={2.5}
        />
      )}
    </button>
  )
}

/** Default trigger button for sidebar */
function DefaultTrigger({
  currentLanguage,
  isTranslating,
}: {
  currentLanguage: Language
  isTranslating: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        "hover:bg-muted/80 text-foreground/80 hover:text-foreground",
        isTranslating && "opacity-60 pointer-events-none"
      )}
    >
      {isTranslating ? (
        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
      ) : (
        <HugeiconsIcon icon={LanguageSkillIcon} size={18} />
      )}
      <span className="truncate notranslate" translate="no">{currentLanguage.name}</span>
      <span className="ml-auto text-base leading-none shrink-0 notranslate" translate="no">{currentLanguage.flag}</span>
    </button>
  )
}

/** Full-screen loading overlay while translation is being applied */
function TranslateOverlay({
  isTranslating,
  language,
}: {
  isTranslating: boolean
  language: Language
}) {
  if (!isTranslating) return null

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          {/* Outer ring */}
          <div className="absolute h-16 w-16 rounded-full border-2 border-muted-foreground/10" />
          {/* Spinning arc */}
          <div className="absolute h-16 w-16 rounded-full border-2 border-transparent border-t-foreground/60 animate-spin" />
          {/* Flag */}
          <span className="text-2xl notranslate" translate="no">{language.flag}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-foreground notranslate" translate="no">
            Translating to {language.name}
          </p>
          <p className="text-xs text-muted-foreground">
            This may take a moment...
          </p>
        </div>
      </div>
    </div>
  )
}
