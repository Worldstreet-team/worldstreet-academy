"use client"

import { useState } from "react"
import { useClerk } from "@clerk/nextjs"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout01Icon } from "@hugeicons/core-free-icons"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogMedia,
} from "@/components/ui/alert-dialog"

const LOGOUT_URL = "https://www.worldstreetgold.com/login"

interface LogoutConfirmDialogProps {
  /**
   * Render prop — receives `openDialog` callback to attach to your trigger element.
   * Example: {(open) => <button onClick={open}>Log out</button>}
   */
  children: (openDialog: () => void) => React.ReactNode
}

export function LogoutConfirmDialog({ children }: LogoutConfirmDialogProps) {
  const { signOut } = useClerk()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleConfirmLogout() {
    setIsLoggingOut(true)
    try {
      // signOut with redirectUrl — Clerk handles the redirect immediately after session ends
      await signOut({ redirectUrl: LOGOUT_URL })
    } catch {
      // Fallback: force hard redirect if Clerk throws
      window.location.replace(LOGOUT_URL)
    }
  }

  function handleOpenChange(open: boolean) {
    // Don't allow closing while logging out
    if (!isLoggingOut) setIsOpen(open)
  }

  return (
    <>
      {children(() => setIsOpen(true))}
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={Logout01Icon} size={22} />
            </AlertDialogMedia>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to the login page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isLoggingOut}
              onClick={handleConfirmLogout}
            >
              {isLoggingOut ? "Logging out…" : "Log out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
