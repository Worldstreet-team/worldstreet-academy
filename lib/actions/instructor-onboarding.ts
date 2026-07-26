"use server"

import connectDB from "@/lib/db"
import { User, Course } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { getIdentityStatus, walletEnabled } from "@/lib/wallet"

// "use server" modules may only export async functions — keep this internal.
const INSTRUCTOR_AGREEMENT_VERSION = "2026-07"

export type InstructorOnboarding = {
  profileComplete: boolean
  signatureSet: boolean
  kycVerified: boolean
  /** null = wallet service unreachable — don't nag about KYC. */
  kycKnown: boolean
  hasCourse: boolean
  agreementAccepted: boolean
  allDone: boolean
}

/**
 * Post-approval onboarding state for the signed-in instructor — drives the
 * checklist card on the instructor overview.
 */
export async function getInstructorOnboarding(): Promise<InstructorOnboarding | null> {
  try {
    await connectDB()
    const me = await getCurrentUser()
    if (!me || (me.role !== "INSTRUCTOR" && me.role !== "ADMIN")) return null

    const [doc, courseCount] = await Promise.all([
      User.findById(me.id).select("bio signatureUrl instructorAgreement").lean(),
      Course.countDocuments({ instructor: me.id }),
    ])

    let kycVerified = false
    let kycKnown = false
    if (walletEnabled()) {
      try {
        const kyc = await getIdentityStatus(me.authUserId)
        kycVerified = kyc.verified
        kycKnown = true
      } catch {
        kycKnown = false
      }
    }

    const profileComplete = Boolean(doc?.bio && doc.bio.trim().length >= 20)
    const signatureSet = Boolean(doc?.signatureUrl)
    const hasCourse = courseCount > 0
    const agreementAccepted = Boolean(doc?.instructorAgreement?.acceptedAt)

    return {
      profileComplete,
      signatureSet,
      kycVerified,
      kycKnown,
      hasCourse,
      agreementAccepted,
      allDone:
        profileComplete &&
        signatureSet &&
        hasCourse &&
        agreementAccepted &&
        (kycVerified || !kycKnown),
    }
  } catch (error) {
    console.error("Instructor onboarding error:", error)
    return null
  }
}

/** Record acceptance of the instructor rev-share agreement (versioned). */
export async function acceptInstructorAgreement() {
  try {
    await connectDB()
    const me = await getCurrentUser()
    if (!me || (me.role !== "INSTRUCTOR" && me.role !== "ADMIN")) {
      return { success: false, error: "Instructor access required" }
    }

    await User.findByIdAndUpdate(me.id, {
      $set: {
        instructorAgreement: { acceptedAt: new Date(), version: INSTRUCTOR_AGREEMENT_VERSION },
      },
    })
    return { success: true }
  } catch (error) {
    console.error("Accept agreement error:", error)
    return { success: false, error: "Failed to record acceptance" }
  }
}
