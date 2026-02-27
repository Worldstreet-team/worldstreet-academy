"use client"

import { useEffect, useRef } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// DOM Patcher — prevent React ↔ Google Translate reconciliation crash
// ─────────────────────────────────────────────────────────────────────────────
let __domPatched = false

function patchDomForTranslate() {
  if (__domPatched) return
  if (typeof Node !== "function" || !Node.prototype) return
  __domPatched = true

  const origRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) return child
    return origRemoveChild.call(this, child) as T
  }

  const origInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    ref: Node | null
  ): T {
    if (ref && ref.parentNode !== this) return newNode
    return origInsertBefore.call(this, newNode, ref) as T
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie management
// ─────────────────────────────────────────────────────────────────────────────

function clearGoogTransCookies() {
  const expiry = "expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
  const hostname = window.location.hostname
  const domains = ["", `domain=${hostname};`, `domain=.${hostname};`]
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

// ─────────────────────────────────────────────────────────────────────────────
// UI enforcer — nuke all Google Translate visible elements
// Runs on every DOM mutation via MutationObserver + on demand after actions.
// Primary CSS is in globals.css; this is the JS backstop.
// ─────────────────────────────────────────────────────────────────────────────

const KILL_SELECTORS = [
  ".goog-te-banner-frame",
  ".goog-te-ftab-frame",
  "#gt-nvframe",
  "#goog-gt-tt",
  ".goog-te-balloon-frame",
  ".goog-te-menu-frame",
  ".goog-te-spinner-pos",
  ".goog-te-menu2",
  ".goog-tooltip",
  ".goog-tooltip-card",
  ".goog-snackbar-container",
  ".VIpgJd-ZVi9od-ORHb-OEVmcd",
  ".VIpgJd-ZVi9od-aZ2wEe-wOHMyf",
  ".VIpgJd-ZVi9od-xl07Ob-OEVmcd",
  ".VIpgJd-ZVi9od-SmfAz",
  ".VIpgJd-ZVi9od-aZ2wEe-OiiCO",
]

function enforceHiddenGoogleUI() {
  // Force body.top back to 0 (Google shifts it down for the banner)
  if (document.body.style.top && document.body.style.top !== "0px") {
    document.body.style.top = "0px"
  }

  // Kill every known Google Translate element
  KILL_SELECTORS.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      const s = (el as HTMLElement).style
      s.setProperty("display", "none", "important")
      s.setProperty("visibility", "hidden", "important")
      s.setProperty("opacity", "0", "important")
      s.setProperty("pointer-events", "none", "important")
      s.setProperty("height", "0", "important")
      s.setProperty("overflow", "hidden", "important")
    })
  })

  // Hide skiptranslate wrappers (but NOT #google_translate_element — it holds the combo)
  document.querySelectorAll("div.skiptranslate").forEach((el) => {
    if ((el as HTMLElement).id === "google_translate_element") return
    const s = (el as HTMLElement).style
    s.setProperty("display", "none", "important")
    s.setProperty("height", "0", "important")
    s.setProperty("overflow", "hidden", "important")
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

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
        setTimeout(() => {
          enforceHiddenGoogleUI()
          resolve()
        }, 800)
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
 * Reset page back to English — uses Google's "show original" mechanism.
 *
 * Sets the combo select to "" (equivalent to clicking Google's "Show Original"
 * button) which triggers Google's internal DOM restore. Then aggressively
 * clears the googtrans cookie in the background to prevent re-translation
 * on the next navigation.
 *
 * No page reload needed — resolves in ~500ms once text is restored.
 */
export function resetToEnglish(): Promise<void> {
  return new Promise((resolve) => {
    // 1. Clear cookies immediately
    clearGoogTransCookies()

    // 2. Reset the combo select — triggers Google's internal "show original" restore
    const select = document.querySelector<HTMLSelectElement>(".goog-te-combo")
    if (select) {
      select.value = ""
      select.dispatchEvent(new Event("change"))
    }

    // 3. Clear cookies again after the event
    clearGoogTransCookies()

    // 4. Keep clearing cookies every 50ms for 2s in the background to beat
    //    Google's async cookie re-write race condition
    const interval = setInterval(clearGoogTransCookies, 50)
    setTimeout(() => clearInterval(interval), 2000)

    // 5. Resolve once the DOM restore has settled (~500ms)
    setTimeout(() => {
      enforceHiddenGoogleUI()
      resolve()
    }, 500)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Component — loads the hidden widget & applies initial language
// ─────────────────────────────────────────────────────────────────────────────

const ALL_LANG_CODES =
  "af,sq,am,ar,hy,az,eu,be,bn,bs,bg,ca,ceb,zh-CN,zh-TW,co,hr,cs,da,nl,eo,et,fi,fr,fy,gl,ka,de,el,gu,ht,ha,haw,iw,hi,hmn,hu,is,ig,id,ga,it,ja,jv,kn,kk,km,rw,ko,ku,ky,lo,la,lv,lt,lb,mk,mg,ms,ml,mt,mi,mr,mn,my,ne,no,ny,or,ps,fa,pl,pt,pa,ro,ru,sm,gd,sr,st,sn,sd,si,sk,sl,so,es,su,sw,sv,tl,tg,ta,tt,te,th,tr,tk,uk,ur,ug,uz,vi,cy,xh,yi,yo,zu"

type TranslateScriptProps = {
  /** Language code to apply on first load */
  initialLanguage?: string | null
}

/**
 * Loads the hidden Google Translate widget and applies initial language.
 * Renders nothing visible — just injects the script and hidden container.
 * All visible Google UI is suppressed by globals.css + MutationObserver.
 */
export function TranslateScript({ initialLanguage }: TranslateScriptProps) {
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Patch DOM once to prevent React crashes
    patchDomForTranslate()

    // Clear stale cookies for English / unset users
    if (!initialLanguage || initialLanguage === "en") {
      clearGoogTransCookies()
    }

    // Create hidden container for the widget
    if (!document.getElementById("google_translate_element")) {
      const div = document.createElement("div")
      div.id = "google_translate_element"
      document.body.appendChild(div)
    }

    // Define the init callback Google will invoke
    ;(window as unknown as Record<string, unknown>).googleTranslateElementInit =
      () => {
        const g = window as unknown as Record<string, Record<string, unknown>>
        const google = g.google as
          | Record<string, Record<string, unknown>>
          | undefined
        if (google?.translate?.TranslateElement) {
          new (
            google.translate.TranslateElement as new (
              opts: Record<string, unknown>,
              id: string
            ) => unknown
          )(
            {
              pageLanguage: "en",
              includedLanguages: ALL_LANG_CODES,
              autoDisplay: false,
              multilanguagePage: true,
            },
            "google_translate_element"
          )

          // Apply saved language after widget init
          if (
            initialLanguage &&
            initialLanguage !== "en" &&
            !hasInitialized.current
          ) {
            hasInitialized.current = true
            changeLanguage(initialLanguage)
          } else if (!initialLanguage || initialLanguage === "en") {
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

    // MutationObserver — continuously enforce hiding on every DOM change.
    // Watches documentElement (not just body) to catch elements Google
    // injects at the <html> level. Also monitors style/class attribute
    // changes so we can immediately reset body.style.top.
    const observer = new MutationObserver(enforceHiddenGoogleUI)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    })

    // Run once immediately
    enforceHiddenGoogleUI()

    return () => {
      observer.disconnect()
    }
  }, [initialLanguage])

  return null
}
