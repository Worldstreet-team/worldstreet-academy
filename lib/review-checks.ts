/**
 * The four recorded checks every Marketplace Creator's course passes before it
 * publishes (institutional blueprint §17's pipeline; controller rulings 7-8).
 * Pure and client-safe, with no imports: the Course model imports its values.
 *
 * A check is stored with the content fingerprint it was recorded against, so a
 * later edit is detected as "the content changed" and voids the pass. Approval
 * needs all four cleared on the current fingerprint.
 */
export const REVIEW_CHECKS = ["content", "quality", "accuracy", "technical"] as const
export type ReviewCheckKey = (typeof REVIEW_CHECKS)[number]
export const REVIEW_CHECK_STATUSES = ["passed", "changes", "n/a"] as const
export type ReviewCheckStatus = (typeof REVIEW_CHECK_STATUSES)[number]

export type CheckState = { status?: ReviewCheckStatus | null; contentHash?: string | null }

export const EMPTY_CHECK = { status: null, by: null, at: null, note: null, contentHash: null } as const

/** Drafted from §17 for the owner's sign-off: the review page, the editor and /sell. */
export const REVIEW_CHECK_DETAILS: Record<ReviewCheckKey, { title: string; qualifier: string | null; body: string }> = {
  content: { title: "Content review", qualifier: null, body: "The topic fits a school of the Academy. The material is original and delivers what its page promises." },
  quality: { title: "Quality review", qualifier: null, body: "Clear structure, clear sound and picture, readable files. A learner can follow it from start to finish." },
  accuracy: { title: "Accuracy review", qualifier: "where relevant", body: "Facts, figures and claims are correct and current. Where there is nothing to fact-check, this review is marked not applicable." },
  technical: { title: "Technical review", qualifier: null, body: "Every video plays and every file opens. The page, the price and the links all work." },
}
export const CHECK_STATUS_LABEL: Record<ReviewCheckStatus | "none", string> = {
  none: "Not checked yet", passed: "Passed", changes: "Changes requested", "n/a": "Not applicable",
}

/** "Not applicable" is only for the accuracy review. */
export function statusAllowed(check: ReviewCheckKey, status: ReviewCheckStatus): boolean {
  return status !== "n/a" || check === "accuracy"
}

export function isCleared(check: CheckState | null | undefined): boolean {
  return check?.status === "passed" || check?.status === "n/a"
}

/** The checks still to do on this content, in pipeline order. */
export function outstandingChecks(
  checks: Partial<Record<ReviewCheckKey, CheckState | null>> | null | undefined,
  contentHash: string
): ReviewCheckKey[] {
  return REVIEW_CHECKS.filter((key) => {
    const c = checks?.[key]
    return !(isCleared(c) && c?.contentHash === contentHash)
  })
}

type Nullish<T> = T | null | undefined
export type ReviewContent = {
  title: string
  description: string
  shortDescription?: Nullish<string>
  thumbnailUrl?: Nullish<string>
  level?: Nullish<string>
  school?: Nullish<string>
  format?: Nullish<string>
  pricing?: Nullish<string>
  price?: Nullish<number>
  whatYouWillLearn?: Nullish<string[]>
  requirements?: Nullish<string[]>
  targetAudience?: Nullish<string[]>
  communityUrl?: Nullish<string>
  productFileKey?: Nullish<string>
  /** Course Resources in order; `lessonIndex` is the owning lesson's position (ids change on every save). */
  resources?: Nullish<
    { title?: Nullish<string>; kind?: Nullish<string>; storageKey?: Nullish<string>; externalUrl?: Nullish<string>; filename?: Nullish<string>; sizeBytes?: Nullish<number>; isFree?: Nullish<boolean>; lessonIndex?: Nullish<number> }[]
  >
  lessons?: Nullish<
    {
      title?: Nullish<string>
      description?: Nullish<string>
      type?: Nullish<string>
      sectionTitle?: Nullish<string>
      videoUrl?: Nullish<string>
      content?: Nullish<string>
      videoDuration?: Nullish<number>
      isFree?: Nullish<boolean>
    }[]
  >
}

/**
 * The canonical string the review fingerprint hashes: fixed field order, no ids, undefined reads as null.
 * Requirements and audience come last, and only when either has a line, so a
 * course without them keeps the fingerprint its checks were recorded on.
 */
export function reviewContentString(c: ReviewContent): string {
  const v = <T>(x: T | null | undefined): T | null => (x === undefined ? null : x)
  return JSON.stringify([
    v(c.title), v(c.shortDescription), v(c.description), v(c.thumbnailUrl), v(c.level), v(c.school), v(c.format),
    v(c.pricing), v(c.price), c.whatYouWillLearn ?? [], v(c.communityUrl), v(c.productFileKey),
    (c.lessons ?? []).map((l) => [v(l.title), v(l.description), v(l.type), v(l.videoUrl), v(l.content), v(l.videoDuration), Boolean(l.isFree), v(l.sectionTitle)]),
    (c.resources ?? []).map((r) => [v(r.title), v(r.kind), v(r.storageKey), v(r.externalUrl), v(r.filename), v(r.sizeBytes), Boolean(r.isFree), v(r.lessonIndex)]),
    ...(c.requirements?.length || c.targetAudience?.length ? [c.requirements ?? [], c.targetAudience ?? []] : []),
  ])
}
