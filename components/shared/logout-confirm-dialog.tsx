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

type LogoutConfirmDialogProps =
  | {
      /** Render-prop mode: wraps a trigger element that opens the dialog. */
      children: (openDialog: () => void) => React.ReactNode
      open?: never
      onOpenChange?: never
    }
  | {
      /** Controlled mode: manage open state externally (use when trigger is in a Dropdown/Popover). */
      open: boolean
      onOpenChange: (open: boolean) => void
      children?: never
    }

export function LogoutConfirmDialog({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: LogoutConfirmDialogProps) {
  const { signOut } = useClerk()
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  function handleOpenChange(open: boolean) {
    if (isLoggingOut) return
    if (controlledOnOpenChange) controlledOnOpenChange(open)
    else setInternalOpen(open)
  }

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

  return (
    <>
      {children && children(() => handleOpenChange(true))}
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
