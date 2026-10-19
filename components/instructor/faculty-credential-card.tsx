import Link from "next/link"
import { BadgeCheckIcon } from "@/components/icons"
import { Card, CardContent } from "@/components/ui/card"
import { FACULTY_CREDENTIAL_NAME, credentialIssuedLabel } from "@/lib/faculty-credential"

/** The instructor's WMA Faculty credential, or what is left to earn it. */
export function FacultyCredentialCard({ credential }: { credential: { id: string; issuedAt: string } | null }) {
  if (!credential) {
    return (
      <Card className="rounded-[20px]">
        <CardContent className="space-y-1 py-5">
          <p className="text-[15px] font-semibold text-foreground">Your {FACULTY_CREDENTIAL_NAME} credential</p>
          <p className="text-[14px] text-muted-foreground">
            Finish your onboarding checklist on the Overview to receive it.{" "}
            <Link href="/instructor" className="font-medium text-foreground underline underline-offset-4">
              Open the Overview
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-[20px]">
      <CardContent className="flex items-center gap-4 py-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-foreground/[0.05]">
          <BadgeCheckIcon size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{FACULTY_CREDENTIAL_NAME}</p>
          <p className="text-[17px] font-semibold tracking-[0.04em] tabular-nums text-foreground">{credential.id}</p>
          <p className="text-[13px] text-muted-foreground">Issued {credentialIssuedLabel(credential.issuedAt)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
