"use server"

import { User } from "@/lib/db/models"
import { initAction } from "./helpers"

export async function vividGetMyCertificates() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, certificates: [], error: "Not authenticated" }

    const { fetchMyCertificates } = await import("@/lib/actions/certificates")
    const certs = await fetchMyCertificates()
    return { success: true, certificates: certs }
  } catch (error) {
    console.error("[Vivid] getMyCertificates error:", error)
    return { success: false, certificates: [], error: "Failed to get certificates" }
  }
}

export async function vividSaveSignature(p: { signatureDataUrl: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { getImageUploadUrl } = await import("@/lib/actions/upload")
    const result = await getImageUploadUrl("signature.png", "image/png")
    if (!result.success || !result.uploadUrl || !result.publicUrl) {
      return { success: false, error: "Failed to prepare upload" }
    }

    const base64Data = p.signatureDataUrl.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    await fetch(result.uploadUrl, {
      method: "PUT",
      body: buffer,
      headers: { "Content-Type": "image/png" },
    })

    const { saveSignature: saveSig } = await import("@/lib/actions/signature")
    await saveSig(result.publicUrl)
    return { success: true, message: "Signature saved!" }
  } catch (error) {
    console.error("[Vivid] saveSignature error:", error)
    return { success: false, error: "Failed to save signature" }
  }
}

export async function vividGetUserSignature() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const user = await User.findById(currentUser.id).select("signatureUrl").lean()
    return {
      success: true,
      hasSignature: !!user?.signatureUrl,
      signatureUrl: user?.signatureUrl || null,
    }
  } catch (error) {
    console.error("[Vivid] getUserSignature error:", error)
    return { success: false, error: "Failed to check signature" }
  }
}
