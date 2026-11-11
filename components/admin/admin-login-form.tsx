"use client"

import * as React from "react"
import { useAuth, useClerk } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminPanelSignIn } from "@/lib/actions/admin-login"

/**
 * The admin panels' sign-in form (Owen, 2026-11-11). The server checks the
 * email and password and hands back a one-minute sign-in token
 * (lib/actions/admin-login.ts); the browser then signs in with it here.
 * WorldStreet keeps one account per browser, so whoever was signed in is
 * signed out first, then the page reloads into the panel as the admin.
 */
export function AdminLoginForm({ level, next }: { level: "admin" | "super"; next: string }) {
  const clerk = useClerk()
  const { isLoaded } = useAuth()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    let leaving = false
    let signedOut = false
    try {
      const result = await adminPanelSignIn({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        level,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      // A callback instead of a redirect keeps this page while the old session ends.
      if (clerk.session) {
        await clerk.signOut(() => undefined)
        signedOut = true
      }
      const signIn = clerk.client?.signIn
      if (!signIn) throw new Error("Clerk client not ready")
      const attempt = await signIn.create({ strategy: "ticket", ticket: result.data.ticket })
      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        throw new Error(`Sign-in stopped at ${attempt.status ?? "unknown"}`)
      }
      await clerk.setActive({ session: attempt.createdSessionId })
      leaving = true
      // A full load, so the server renders the panel with the new session.
      window.location.assign(next)
    } catch (err) {
      console.error("Admin sign-in failed:", err)
      setError(
        signedOut
          ? "You were signed out, but the admin sign-in didn't finish. Reload the page and sign in again."
          : "Couldn't finish signing you in. Reload the page and try again."
      )
    } finally {
      if (!leaving) setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="admin-email">Email</Label>
        <Input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          disabled={pending}
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-password">Password</Label>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className="h-11"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-ws-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending || !isLoaded}>
        {pending ? "Signing in…" : level === "super" ? "Sign in as super admin" : "Sign in to admin"}
      </Button>
    </form>
  )
}
