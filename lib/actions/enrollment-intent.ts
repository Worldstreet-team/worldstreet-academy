"use server"

import mongoose from "mongoose"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Enrollment, EnrollmentIntent, type PackageKey } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { fetchProgramById } from "@/lib/actions/student"
import { SCHOOL_SLUGS, isSchoolSlug, type SchoolSlug } from "@/lib/schools"

const SaveSchema = z.object({
  school: z.enum(SCHOOL_SLUGS),
  courseId: z
    .string()
    .refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid program")
    .nullable()
    .default(null),
  packageKey: z.enum(["basic", "standard", "executive"]).nullable().default(null),
  source: z.enum(["landing", "start", "checkout"]),
})

export type SaveEnrollmentIntentInput = z.input<typeof SaveSchema>

type SaveResult =
  | { success: true; data: { checkoutHref: string | null } }
  | { success: false; error: string }

function checkoutHrefFor(courseId: string | null, packageKey: PackageKey | null): string | null {
  if (!courseId) return null
  return `/dashboard/checkout?courseId=${courseId}${packageKey ? `&package=${packageKey}` : ""}`
}

/**
 * Save "the school I picked" — with the program and package once chosen.
 * Idempotent; the newest choice overwrites. Changing school or program
 * restarts the pay-later clock. Identity comes from the session only.
 */
export async function saveEnrollmentIntent(input: SaveEnrollmentIntentInput): Promise<SaveResult> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Sign in to save your school" }

    const parsed = SaveSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "That choice isn't valid" }
    const { school, courseId, source } = parsed.data
    let packageKey: PackageKey | null = parsed.data.packageKey

    if (courseId) {
      const program = await fetchProgramById(courseId)
      if (!program || program.status !== "published") return { success: false, error: "That program isn't available" }
      if (program.school !== school) return { success: false, error: "That program isn't part of this school" }
      // A program without a ladder has one synthesized tier; it carries no key.
      if (program.tierCount === 0) packageKey = null
      else if (packageKey && !program.packages.some((p) => p.key === packageKey)) {
        return { success: false, error: "That package isn't on sale" }
      }
    } else {
      packageKey = null
    }

    const existing = await EnrollmentIntent.findOne({ user: user.id }).select("school course").lean()
    const changed =
      !existing || existing.school !== school || String(existing.course ?? "") !== (courseId ?? "")

    await EnrollmentIntent.updateOne(
      { user: user.id },
      {
        $set: {
          school,
          course: courseId,
          packageKey,
          source,
          status: "open",
          ...(changed ? { savedAt: new Date(), "nudges.h24SentAt": null, "nudges.h72SentAt": null } : {}),
        },
        $setOnInsert: { user: user.id },
      },
      { upsert: true }
    )

    revalidatePath("/dashboard")
    return { success: true, data: { checkoutHref: checkoutHrefFor(courseId, packageKey) } }
  } catch (error) {
    console.error("Save enrollment intent error:", error)
    return { success: false, error: "Couldn't save your choice — try again" }
  }
}

export type MyEnrollmentIntent = {
  school: SchoolSlug
  courseId: string | null
  courseTitle: string | null
  packageName: string | null
  /** Whole USD for the chosen package, else the program's cheapest; null with no program. */
  price: number | null
  /** True when `price` is a "from" figure (a ladder with no package chosen). */
  fromPrice: boolean
  /** Checkout when a program is chosen, else back into the picker. */
  href: string
}

/** The signed-in learner's OPEN intent, or null. Converts it when its enrollment exists. */
export async function getMyEnrollmentIntent(): Promise<MyEnrollmentIntent | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const intent = await EnrollmentIntent.findOne({ user: user.id, status: "open" }).lean()
    if (!intent || !isSchoolSlug(intent.school)) return null
    const school = intent.school
    const courseId = intent.course ? String(intent.course) : null
    const schoolOnly: MyEnrollmentIntent = {
      school, courseId: null, courseTitle: null, packageName: null, price: null, fromPrice: false,
      href: `/dashboard/start?school=${school}`,
    }
    if (!courseId) return schoolOnly

    if (await Enrollment.exists({ user: user.id, course: courseId })) {
      await EnrollmentIntent.updateOne({ _id: intent._id }, { $set: { status: "converted" } })
      return null
    }

    const program = await fetchProgramById(courseId)
    if (!program || program.status !== "published") return schoolOnly

    const chosen = intent.packageKey ? program.packages.find((p) => p.key === intent.packageKey) : undefined
    return {
      school,
      courseId,
      courseTitle: program.title,
      packageName: chosen && program.tierCount > 1 ? chosen.name : null,
      price: chosen ? chosen.price : program.price,
      fromPrice: !chosen && program.tierCount > 1,
      href: checkoutHrefFor(courseId, chosen ? chosen.key : null) ?? `/dashboard/start?school=${school}`,
    }
  } catch (error) {
    console.error("Get enrollment intent error:", error)
    return null
  }
}

/** "Not now" on the dashboard card. The row stays, so the gate never re-asks. */
export async function dismissEnrollmentIntent(): Promise<{ success: boolean }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false }
    await EnrollmentIntent.updateOne({ user: user.id, status: "open" }, { $set: { status: "dismissed" } })
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Dismiss enrollment intent error:", error)
    return { success: false }
  }
}
