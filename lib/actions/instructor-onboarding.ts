"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { User, Course } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { getIdentityStatus, walletEnabled } from "@/lib/wallet"
import { HANDBOOK_KEYS, HANDBOOK_PAGES, type HandbookKey } from "@/lib/faculty-handbook"
import { credentialReady, generateFacultyCredentialId, type KycState } from "@/lib/faculty-credential"

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
  /** Every item except "Create your first course", with KYC verified or not required. */
  credentialReady: boolean
  /** The WMA Faculty credential, once issued. Never changes after that. */
  credential: { id: string; issuedAt: string } | null
  allDone: boolean
}

type StoredCredential = { id: string; issuedAt: Date }

/**
 * Issue the WMA Faculty credential once. Module-private on purpose: a
 * "use server" export that takes a user id would be callable by anyone. The
 * filter matches only a profile with no credential, so a stored ID never moves.
 * Never throws; returns null on failure.
 */
async function ensureFacultyCredential(userId: string): Promise<StoredCredential | null> {
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const id = generateFacultyCredentialId()
      const issuedAt = new Date()
      try {
        const res = await User.updateOne(
          { _id: userId, "instructorProfile.credential.id": { $exists: false } },
          { $set: { "instructorProfile.credential": { id, issuedAt } } }
        )
        if (res.modifiedCount === 1) return { id, issuedAt }
        break // already issued (or no such user): read what is stored
      } catch (error) {
        const e = error as { code?: number; keyPattern?: Record<string, unknown> }
        if (e.code === 11000 && e.keyPattern?.["instructorProfile.credential.id"]) continue
        throw error
      }
    }
    const doc = await User.findById(userId).select("instructorProfile.credential").lean()
    const c = doc?.instructorProfile?.credential
    return c?.id ? { id: c.id, issuedAt: new Date(c.issuedAt) } : null
  } catch (error) {
    console.error("[Faculty] credential issue failed:", error)
    return null
  }
}

async function onboardingFor(me: { id: string; authUserId: string }): Promise<InstructorOnboarding> {
  const [doc, courseCount] = await Promise.all([
    User.findById(me.id).select("bio signatureUrl instructorAgreement instructorProfile.handbook instructorProfile.credential").lean(),
    Course.countDocuments({ instructor: me.id }),
  ])

  let kycVerified = false
  let kycKnown = false
  let kyc: KycState = "not_required"
  if (walletEnabled()) {
    try {
      const status = await getIdentityStatus(me.authUserId)
      kycVerified = status.verified
      kycKnown = true
      kyc = status.verified ? "verified" : "unverified"
    } catch {
      kycKnown = false
      kyc = "unknown"
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
  const handbookDone = HANDBOOK_KEYS.every((k) => handbook[k])
  const ready = credentialReady({ agreementAccepted, profileComplete, signatureSet, handbookDone, kyc })

  const stored = doc?.instructorProfile?.credential
  let credential: StoredCredential | null = stored?.id ? { id: stored.id, issuedAt: new Date(stored.issuedAt) } : null
  if (ready && !credential) credential = await ensureFacultyCredential(me.id)

  return {
    profileComplete,
    signatureSet,
    kycVerified,
    kycKnown,
    hasCourse,
    agreementAccepted,
    handbook,
    credentialReady: ready,
    credential: credential ? { id: credential.id, issuedAt: credential.issuedAt.toISOString() } : null,
    allDone: profileComplete && signatureSet && hasCourse && agreementAccepted && handbookDone && (kycVerified || !kycKnown),
  }
}

/**
 * Post-approval onboarding state for the signed-in instructor — drives the
 * checklist card on the instructor overview. A ready member receives the
 * WMA Faculty credential here.
 */
export async function getInstructorOnboarding(): Promise<InstructorOnboarding | null> {
  try {
    await connectDB()
    const me = await getCurrentUser()
    if (!me || (me.role !== "INSTRUCTOR" && me.role !== "ADMIN")) return null
    return await onboardingFor(me)
  } catch (error) {
    console.error("Instructor onboarding error:", error)
    return null
  }
}

/** The caller's WMA Faculty credential (issued here too, if they are ready), or null. */
export async function getMyFacultyCredential(): Promise<{ id: string; issuedAt: string } | null> {
  try {
    await connectDB()
    const me = await getCurrentUser()
    if (!me || (me.role !== "INSTRUCTOR" && me.role !== "ADMIN")) return null
    return (await onboardingFor(me)).credential
  } catch (error) {
    console.error("Faculty credential error:", error)
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
