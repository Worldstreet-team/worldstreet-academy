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
 * Clear all googtrans cookies across every domain/path variant Google may use.
 */
function clearGoogTransCookies() {
  const expiry = "expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
  const hostname = window.location.hostname
  // Build a list of domain variants to clear against
  const domains = ["", `domain=${hostname};`, `domain=.${hostname};`]
  // Also try the parent domain (e.g. .worldstreetgold.com from academy.worldstreetgold.com)
  const parts = hostname.split(".")
  if (parts.length > 2) {
    const parent = parts.slice(1).join(".")
    domains.push(`domain=.${parent};`)
  }
  domains.forEach((d) => {
    document.cookie = `googtrans=; ${expiry} ${d}`
    document.cookie = `googtrans=/en/en; ${expiry} ${d}`
  })
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
 * Clears all googtrans cookies then reloads — the only fully reliable reset.
 */
export function resetToEnglish(): Promise<void> {
  return new Promise((resolve) => {
    clearGoogTransCookies()

    // Try the select first for a soft reset (no flash)
    const attempt = (tries: number) => {
      const select = document.querySelector<HTMLSelectElement>(".goog-te-combo")
      if (select) {
        select.value = ""
        select.dispatchEvent(new Event("change"))
        // After soft reset, clear again in case translate re-set the cookie
        setTimeout(() => {
          clearGoogTransCookies()
          resolve()
        }, 800)
        return
      }
      if (tries > 0) {
        setTimeout(() => attempt(tries - 1), 300)
      } else {
        // No widget found — cookie is cleared, just reload
        window.location.reload()
        resolve()
      }
    }
    attempt(10)
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

    // If the user's saved language is English (or not set), clear any stale
    // googtrans cookie immediately — before the widget even initialises.
    // This is what prevents the foreign language persisting across reloads.
    if (!initialLanguage || initialLanguage === "en") {
      clearGoogTransCookies()
    }

    // Inject hide styles
    const style = document.createElement("style")
    style.textContent = `
      .goog-te-banner-frame,
      #goog-gt-tt,
      .goog-te-balloon-frame,
      .goog-te-menu-frame,
      .skiptranslate iframe,
      .goog-te-spinner-pos,
      .VIpgJd-ZVi9od-ORHb-OEVmcd,
      .VIpgJd-ZVi9od-aZ2wEe-wOHMyf,
      .VIpgJd-ZVi9od-xl07Ob-OEVmcd,
      .goog-tooltip,
      .goog-tooltip-card,
      .goog-snackbar-container {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
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
        } else if (!initialLanguage || initialLanguage === "en") {
          // Clear cookies again after widget init in case Google re-set them
          clearGoogTransCookies()
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

    // Watch for any Google Translate UI injected dynamically and kill it immediately
    const HIDDEN_SELECTORS = [
      ".goog-te-banner-frame",
      ".goog-te-balloon-frame",
      ".goog-te-menu-frame",
      ".goog-te-spinner-pos",
      ".VIpgJd-ZVi9od-ORHb-OEVmcd",
      ".VIpgJd-ZVi9od-aZ2wEe-wOHMyf",
      ".VIpgJd-ZVi9od-xl07Ob-OEVmcd",
      ".goog-tooltip",
      ".goog-tooltip-card",
      ".goog-snackbar-container",
      "#goog-gt-tt",
    ]

    const hideGoogleUI = () => {
      HIDDEN_SELECTORS.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          ;(el as HTMLElement).style.cssText =
            "display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;"
        })
      })
      // Keep body from shifting
      document.body.style.top = "0px"
    }

    const observer = new MutationObserver(hideGoogleUI)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      style.remove()
      observer.disconnect()
    }
  }, [initialLanguage])

  return null
}
