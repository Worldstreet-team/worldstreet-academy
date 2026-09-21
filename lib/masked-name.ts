/**
 * How a public page names a reviewer: first name + last initial ("Johnson D."),
 * the first name alone when there is no last name — the same masking as
 * `/verify`. Shared by the program and school pages' review reads; it lives in
 * a plain module because a "use server" file may only export async functions.
 */
export function maskedName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const initial = lastName?.trim().charAt(0).toUpperCase()
  return [firstName?.trim(), initial ? `${initial}.` : ""].filter(Boolean).join(" ") || "WorldStreet learner"
}
