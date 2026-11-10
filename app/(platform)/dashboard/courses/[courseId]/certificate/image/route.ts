import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse, type NextRequest } from "next/server"
import { fetchCertificate } from "@/lib/actions/certificates"
import { certificatePng, type CertificateArt } from "@/lib/certificate-art"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"

/**
 * GET /dashboard/courses/<courseId>/certificate/image[?size=print]
 *
 * The signed-in learner's own certificate as a PNG (lib/certificate-art.tsx):
 * 1754×1240 for the page, 3508×2480 (A4 at 300 dpi) for the PDF and PNG
 * downloads. A route handler because a server action can't answer with an
 * image. `fetchCertificate` is the gate: only the holder of a completed,
 * certifying enrollment gets a picture, and a marketplace certificate whose
 * creator hasn't signed gets none (403), so the download rule can't be
 * sidestepped by opening this URL.
 */

const MAX_SIGNATURE_BYTES = 2_000_000
const SIGNATURE_TYPES = /^image\/(png|jpeg|svg\+xml)$/

/**
 * A stored signature as a data URL, or null. Only our public bucket is read
 * (the rule `saveSignature` enforces, re-checked for older rows), with a
 * timeout, so a bad row can neither stall the render nor reach another host.
 */
async function signatureData(url: string | null): Promise<string | null> {
  const bucket = process.env.R2_PUBLIC_URL
  if (!url || !bucket || !url.startsWith(`${bucket}/`)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000), cache: "no-store" })
    if (!res.ok) return null
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim()
    if (!SIGNATURE_TYPES.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_SIGNATURE_BYTES) return null
    return `data:${type};base64,${buf.toString("base64")}`
  } catch (err) {
    console.error("[Certificate] signature fetch failed:", err)
    return null
  }
}

/** The Academy signatory's file (BRAND.signatory.imagePath, a public path). */
async function publicImage(path: string): Promise<string | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public", path.replace(/^\/+/, "")))
    const type = path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "image/png"
    return `data:${type};base64,${buf.toString("base64")}`
  } catch (err) {
    console.error("[Certificate] signatory image missing:", err)
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  if (!/^[a-f0-9]{24}$/.test(courseId)) return new NextResponse("Not found", { status: 404 })

  const data = await fetchCertificate(courseId)
  if (!data) return new NextResponse("Not found", { status: 404 })
  if (data.locked) return new NextResponse("This certificate is waiting for the instructor's signature", { status: 403 })

  // Same ID the page prints: the stored one, else the legacy value (lib/certificate-id.ts).
  const certificateId = data.certificateId ?? `${BRAND.certificatePrefix}-${data.id.slice(-8).toUpperCase()}`
  const verifyLabel = data.certificateId ? appUrl(`/verify/${data.certificateId}`).replace(/^https?:\/\//, "") : null

  const signatory = BRAND.signatory
  const [holderSignature, issuer] = await Promise.all([
    signatureData(data.studentSignatureUrl),
    (async (): Promise<CertificateArt["issuer"]> => {
      if (!data.issuedByAcademy) {
        return { label: "Instructor", name: data.instructorName || "Instructor", signature: await signatureData(data.instructorSignatureUrl) }
      }
      // The Academy's signatory (D9) once product supplies both name and file; until then the Academy issues it.
      if (signatory.name && signatory.imagePath) {
        return { label: signatory.title ?? "Authorised signatory", name: signatory.name, signature: await publicImage(signatory.imagePath) }
      }
      return { label: "Issued by", name: BRAND.name, signature: await signatureData(data.instructorSignatureUrl) }
    })(),
  ])

  const print = req.nextUrl.searchParams.get("size") === "print"
  try {
    // Drawn in full before answering, so a render error is a 500 here rather than a broken stream.
    const png = await certificatePng(
      {
        tier: data.tier,
        holderName: data.studentName || "Academy learner",
        programName: data.programName,
        schoolName: data.schoolName,
        completedAt: data.completedAt,
        certificateId,
        verifyLabel,
        holderSignature,
        issuer,
      },
      print ? 2 : 1
    )
    return new NextResponse(png, {
      headers: { "Content-Type": "image/png", "Content-Length": String(png.byteLength), "Cache-Control": "private, no-store" },
    })
  } catch (err) {
    console.error("[Certificate] render failed:", err)
    return new NextResponse("Couldn't draw the certificate", { status: 500 })
  }
}
