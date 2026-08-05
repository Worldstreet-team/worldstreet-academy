"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import {
  ChevronRight,
  LogOut,
  Mail,
  Moon,
  Sun,
  UserRound,
} from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { useUser } from "@/components/providers/user-provider"
import { LanguagePicker } from "@/components/translator/language-picker"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"
import { cn } from "@/lib/utils"

/** Section shell: label + caption above a hairline card of rows. */
function SettingsSection({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: React.ReactNode
}) {
  return (
    <section className="">
      <h2 className="text-sm font-semibold text-ws-primary">{title}</h2>
      <p className="mt-0.5 text-[13px] text-ws-muted">{caption}</p>
      <div className="mt-3 divide-y divide-ws-hairline overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface">
        {children}
      </div>
    </section>
  )
}

/** 40px icon chip used at the start of each row. */
function RowChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised text-ws-muted">
      {children}
    </span>
  )
}

/** Two-option Light/Dark segmented control driven by next-themes. */
function ThemeSegmented() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const

  return (
    <div className="flex h-10 shrink-0 items-center rounded-full bg-ws-track p-[3px]">
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && resolvedTheme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            className={cn(
              "flex h-[34px] items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors duration-[var(--ws-motion-fast)]",
              active
                ? "bg-ws-raised font-semibold text-ws-primary"
                : "font-medium text-ws-muted hover:text-ws-primary"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsPage() {
  const user = useUser()

  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <PageHeader
            title="Settings"
            subline="Appearance, language, and account controls."
          />

          <div className="space-y-8">
            {/* ── Appearance ─────────────────────────────── */}
            <SettingsSection
              title="Appearance"
              caption="Choose how the Academy looks on this device."
            >
              <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ws-primary">Theme</p>
                  <p className="text-[13px] text-ws-muted">
                    Applies instantly and is remembered on this browser.
                  </p>
                </div>
                <ThemeSegmented />
              </div>
            </SettingsSection>

            {/* ── Language ───────────────────────────────── */}
            <SettingsSection
              title="Language"
              caption="Translates the Academy interface. Saved to your account."
            >
              <LanguagePicker defaultLanguage={user.preferredLanguage}>
                {({ currentLanguage, isTranslating }) => (
                  <button
                    type="button"
                    disabled={isTranslating}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-2 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60 disabled:pointer-events-none disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ws-primary">
                        Display language
                      </p>
                      <p className="text-[13px] text-ws-muted">
                        {isTranslating
                          ? "Applying translation…"
                          : "Pick from 100+ languages."}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 text-sm text-ws-muted">
                      <span
                        className="inline-flex h-4 items-center rounded-xs bg-ws-chip px-1 text-[9px] font-semibold uppercase tracking-wide text-ws-muted notranslate"
                        translate="no"
                      >
                        {currentLanguage.code}
                      </span>
                      <span className="notranslate" translate="no">
                        {currentLanguage.name}
                      </span>
                      <ChevronRight className="h-4 w-4 text-ws-subtle" />
                    </span>
                  </button>
                )}
              </LanguagePicker>
            </SettingsSection>

            {/* ── Account ────────────────────────────────── */}
            <SettingsSection
              title="Account"
              caption="Your profile and sign-in details."
            >
              <Link
                href="/dashboard/profile"
                className="flex min-h-14 items-center gap-3 px-5 py-2 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60"
              >
                <RowChip>
                  <UserRound className="h-[18px] w-[18px]" />
                </RowChip>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ws-primary">
                    Edit profile
                  </p>
                  <p className="text-[13px] text-ws-muted">
                    Name, photo, bio and signature.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ws-subtle" />
              </Link>

              <div className="flex min-h-14 items-center gap-3 px-5 py-2">
                <RowChip>
                  <Mail className="h-[18px] w-[18px]" />
                </RowChip>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ws-primary">Email</p>
                  <p className="text-[13px] text-ws-muted">
                    Managed by your WorldStreet account.
                  </p>
                </div>
                <span className="truncate text-[13px] text-ws-muted">
                  {user.email}
                </span>
              </div>
            </SettingsSection>

            {/* ── Session ────────────────────────────────── */}
            <SettingsSection
              title="Session"
              caption="Sign out of the Academy on this device."
            >
              <LogoutConfirmDialog>
                {(openDialog) => (
                  <button
                    type="button"
                    onClick={openDialog}
                    className="flex min-h-14 w-full items-center gap-3 px-5 py-2 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-danger/10 text-ws-danger">
                      <LogOut className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ws-danger">
                        Log out
                      </p>
                      <p className="text-[13px] text-ws-muted">
                        You will be returned to the login page.
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ws-subtle" />
                  </button>
                )}
              </LogoutConfirmDialog>
            </SettingsSection>
          </div>
        </div>
      </div>
    </>
  )
}
