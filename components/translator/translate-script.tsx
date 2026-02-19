"use client"

import { useEffect, useRef } from "react"

/**
 * Patches React DOM methods to prevent crashes when Google Translate
 * wraps text nodes in <font> tags, causing React reconciliation errors.
 */
function patchDomForTranslate() {
  if (typeof Node !== "function" || !Node.prototype) return

  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) return child
    return originalRemoveChild.call(this, child) as T
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) return newNode
    return originalInsertBefore.call(this, newNode, referenceNode) as T
  }
}

/**
 * Programmatically change the page language via the hidden Google Translate select.
 */
export function changeLanguage(langCode: string): Promise<void> {
  return new Promise((resolve) => {
    const attempt = (tries: number) => {
      const select = document.querySelector<HTMLSelectElement>(".goog-te-combo")
      if (select) {
        select.value = langCode
        select.dispatchEvent(new Event("change"))
        // Give Google Translate a moment to process
        setTimeout(resolve, 800)
        return
      }
      if (tries > 0) {
        setTimeout(() => attempt(tries - 1), 300)
      } else {
        resolve()
      }
    }
    attempt(15)
  })
}

/**
 * Reset page back to English.
 */
export function resetToEnglish(): Promise<void> {
  return new Promise((resolve) => {
    // Clear googtrans cookies
    const expiry = "expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    document.cookie = `googtrans=; ${expiry}`
    document.cookie = `googtrans=; ${expiry} domain=${window.location.hostname}`
    document.cookie = `googtrans=; ${expiry} domain=.${window.location.hostname}`

    const attempt = (tries: number) => {
      const select = document.querySelector<HTMLSelectElement>(".goog-te-combo")
      if (select) {
        select.value = ""
        select.dispatchEvent(new Event("change"))
        setTimeout(resolve, 800)
        return
      }
      if (tries > 0) {
        setTimeout(() => attempt(tries - 1), 300)
      } else {
        resolve()
      }
    }
    attempt(15)
  })
}

// All language codes for Google Translate's includedLanguages param
const ALL_LANG_CODES =
  "af,sq,am,ar,hy,az,eu,be,bn,bs,bg,ca,ceb,zh-CN,zh-TW,co,hr,cs,da,nl,eo,et,fi,fr,fy,gl,ka,de,el,gu,ht,ha,haw,iw,hi,hmn,hu,is,ig,id,ga,it,ja,jv,kn,kk,km,rw,ko,ku,ky,lo,la,lv,lt,lb,mk,mg,ms,ml,mt,mi,mr,mn,my,ne,no,ny,or,ps,fa,pl,pt,pa,ro,ru,sm,gd,sr,st,sn,sd,si,sk,sl,so,es,su,sw,sv,tl,tg,ta,tt,te,th,tr,tk,uk,ur,ug,uz,vi,cy,xh,yi,yo,zu"

type TranslateScriptProps = {
  /** Language code to apply on first load */
  initialLanguage?: string | null
}

/**
 * Loads the hidden Google Translate widget and applies initial language.
 * Renders nothing visible — just injects the script and hidden container.
 */
export function TranslateScript({ initialLanguage }: TranslateScriptProps) {
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Patch DOM once
    patchDomForTranslate()

    // Inject hide styles
    const style = document.createElement("style")
    style.textContent = `
      .goog-te-banner-frame,
      #goog-gt-tt,
      .goog-te-balloon-frame,
      .skiptranslate iframe,
      .goog-te-spinner-pos {
        display: none !important;
      }
      body {
        top: 0 !important;
      }
      #google_translate_element {
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 0;
        height: 0;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
      }
      .goog-te-gadget {
        font-size: 0 !important;
        height: 0 !important;
      }
    `
    document.head.appendChild(style)

    // Create hidden container for widget
    if (!document.getElementById("google_translate_element")) {
      const div = document.createElement("div")
      div.id = "google_translate_element"
      document.body.appendChild(div)
    }

    // Define the init callback
    ;(window as unknown as Record<string, unknown>).googleTranslateElementInit = () => {
      const g = window as unknown as Record<string, Record<string, unknown>>
      const google = g.google as Record<string, Record<string, unknown>> | undefined
      if (google?.translate?.TranslateElement) {
        new (google.translate.TranslateElement as new (
          opts: Record<string, unknown>,
          id: string
        ) => unknown)(
          {
            pageLanguage: "en",
            includedLanguages: ALL_LANG_CODES,
            autoDisplay: false,
            multilanguagePage: true,
          },
          "google_translate_element"
        )

        // Apply saved language after widget loads
        if (initialLanguage && initialLanguage !== "en" && !hasInitialized.current) {
          hasInitialized.current = true
          changeLanguage(initialLanguage)
        }
      }
    }

    // Load the Google Translate script
    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script")
      script.id = "google-translate-script"
      script.src =
        "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      style.remove()
    }
  }, [initialLanguage])

  return null
}
