"use client"

import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getInstructorOnboarding,
  acceptInstructorAgreement,
} from "@/lib/actions/instructor-onboarding"
import { CircleCheckBigIcon } from "lucide-react"

function Item({
  done,
  label,
  href,
  action,
}: {
  done: boolean
  label: string
  href?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${
          done
            ? "bg-ws-success border-ws-success text-white"
            : "border-muted-foreground/30"
        }`}
      >
        {done && <CircleCheckBigIcon  size={12} />}
      </span>
      <span className={`text-xs flex-1 ${done ? "text-muted-foreground line-through" : "font-medium"}`}>
        {label}
      </span>
      {!done &&
        (action ??
          (href ? (
            <Button size="xs" variant="outline" render={<Link href={href} />}>
              Do it
            </Button>
          ) : null))}
    </div>
  )
}

/**
 * Post-approval onboarding checklist — shown on the instructor overview until
 * every step is complete, then disappears for good.
 */
export function OnboardingChecklist() {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ["instructor-onboarding"],
    queryFn: () => getInstructorOnboarding(),
    staleTime: 60_000,
  })

  const accept = useMutation({
    mutationFn: () => acceptInstructorAgreement(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["instructor-onboarding"] }),
  })

  if (!data || data.allDone) return null

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardContent className="p-4">
        <h2 className="text-sm font-semibold">Finish setting up your instructor account</h2>
        <p className="text-[11px] text-muted-foreground mb-2">
          Complete these once — they unlock payouts and boost student trust.
        </p>
        <div className="divide-y divide-border/40">
          <Item
            done={data.agreementAccepted}
            label="Accept the instructor agreement (85/15 revenue share)"
            action={
              <Button
                size="xs"
                variant="outline"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? "Saving…" : "Accept"}
              </Button>
            }
          />
          <Item
            done={data.profileComplete}
            label="Complete your public profile (bio)"
            href="/instructor/profile"
          />
          <Item
            done={data.signatureSet}
            label="Add your certificate signature"
            href="/instructor/settings"
          />
          {data.kycKnown && (
            <Item
              done={data.kycVerified}
              label="Verify your identity for payouts (KYC)"
              href="/dashboard/wallet"
            />
          )}
          <Item
            done={data.hasCourse}
            label="Create your first course"
            href="/instructor/courses/new"
          />
        </div>
      </CardContent>
    </Card>
  )
}
