"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { User, Course } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { getIdentityStatus, walletEnabled } from "@/lib/wallet"
import { HANDBOOK_KEYS, HANDBOOK_PAGES, type HandbookKey } from "@/lib/faculty-handbook"

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
  /** Handbook pages the instructor has acknowledged (institutional blueprint §16). */
  handbook: Record<HandbookKey, boolean>
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
      User.findById(me.id).select("bio signatureUrl instructorAgreement instructorProfile.handbook instructorProfile.credential").lean(),
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
    const h = doc?.instructorProfile?.handbook
    const handbook: Record<HandbookKey, boolean> = {
      teachingStandards: Boolean(h?.teachingStandardsAt),
      curriculumGuidelines: Boolean(h?.curriculumGuidelinesAt),
      platformTraining: Boolean(h?.platformTrainingAt),
    }

    return {
      profileComplete,
      signatureSet,
      kycVerified,
      kycKnown,
      hasCourse,
      agreementAccepted,
      handbook,
      allDone:
        profileComplete &&
        signatureSet &&
        hasCourse &&
        agreementAccepted &&
        HANDBOOK_KEYS.every((k) => handbook[k]) &&
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

const handbookKeySchema = z.enum(HANDBOOK_KEYS)

/**
 * Acknowledge one handbook page. The first acknowledgement wins: the filter
 * matches only a page still `null`, so a repeat never moves the date.
 */
export async function acknowledgeHandbook(
  key: HandbookKey
): Promise<{ success: true; data: { acknowledgedAt: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const me = await getCurrentUser()
    if (!me || (me.role !== "INSTRUCTOR" && me.role !== "ADMIN")) {
      return { success: false, error: "Instructor access required" }
    }
    const parsed = handbookKeySchema.safeParse(key)
    if (!parsed.success) return { success: false, error: "Unknown handbook page" }

    const path = `instructorProfile.handbook.${parsed.data}At`
    await User.updateOne({ _id: me.id, [path]: null }, { $set: { [path]: new Date() } })

    const doc = await User.findById(me.id).select("instructorProfile.handbook").lean()
    const at = doc?.instructorProfile?.handbook?.[`${parsed.data}At`]
    if (!at) return { success: false, error: "Failed to record acknowledgement" }

    const page = HANDBOOK_PAGES.find((x) => x.key === parsed.data)
    revalidatePath("/instructor")
    revalidatePath("/instructor/handbook")
    if (page) revalidatePath(`/instructor/handbook/${page.slug}`)
    return { success: true, data: { acknowledgedAt: new Date(at).toISOString() } }
  } catch (error) {
    console.error("Acknowledge handbook error:", error)
    return { success: false, error: "Failed to record acknowledgement" }
  }
}

/** The caller's handbook acknowledgements (ISO or null). All null on any failure. */
export async function getMyHandbookStatus(): Promise<Record<HandbookKey, string | null>> {
  const none: Record<HandbookKey, string | null> = {
    teachingStandards: null,
    curriculumGuidelines: null,
    platformTraining: null,
  }
  try {
    await connectDB()
    const me = await getCurrentUser()
    if (!me) return none
    const doc = await User.findById(me.id).select("instructorProfile.handbook").lean()
    const h = doc?.instructorProfile?.handbook
    const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)
    return {
      teachingStandards: iso(h?.teachingStandardsAt),
      curriculumGuidelines: iso(h?.curriculumGuidelinesAt),
      platformTraining: iso(h?.platformTrainingAt),
    }
  } catch (error) {
    console.error("Handbook status error:", error)
    return none
  }
}
