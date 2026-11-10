"use client"

import * as React from "react"

/*
 * Lesson text is HTML written in the rich text editor, by a program's owner or
 * its assigned tutors, and it is shown to learners — publicly too, for a free
 * preview lesson. Stored text is never trusted: it is parsed by the browser
 * into an inert document (DOMParser runs no scripts and loads no images) and
 * only the editor's own formatting is copied into fresh elements — no
 * attributes but a checked link — so nothing in it can run.
 *
 * It renders only in the browser: the server's HTML carries no lesson markup,
 * since the server has no parser to clean it with.
 */

/** The tags the editor (TipTap's StarterKit) produces; anything else keeps only its text. */
const ALLOWED_TAGS = new Set([
  "P", "BR", "HR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "CODE", "PRE", "BLOCKQUOTE",
  "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "A",
])
/** Their content is never text a reader should see. */
const DROPPED_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "TITLE", "HEAD"])

function safeHref(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.href : null
  } catch {
    return null
  }
}

function copyChildren(from: Node, to: Node, doc: Document): void {
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      to.appendChild(doc.createTextNode(child.textContent ?? ""))
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as Element
    const tag = el.tagName.toUpperCase()
    if (DROPPED_WITH_CONTENT.has(tag)) continue
    if (!ALLOWED_TAGS.has(tag)) {
      // Unknown wrapper (div, span …): keep what it says, not the element.
      copyChildren(el, to, doc)
      continue
    }
    const clean = doc.createElement(tag.toLowerCase())
    if (tag === "A") {
      const href = safeHref(el.getAttribute("href"))
      if (href) {
        clean.setAttribute("href", href)
        clean.setAttribute("target", "_blank")
        clean.setAttribute("rel", "noopener noreferrer nofollow")
      }
    }
    copyChildren(el, clean, doc)
    to.appendChild(clean)
  }
}

/** The editor's formatting from `html`, with everything else removed. Browser only. */
export function sanitizeLessonHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html")
  const out = document.implementation.createHTMLDocument("")
  const root = out.createElement("div")
  copyChildren(parsed.body, root, out)
  return root.innerHTML
}

const subscribe = () => () => {}

/** Lesson HTML, cleaned in the browser (see the note above). */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const inBrowser = React.useSyncExternalStore(subscribe, () => true, () => false)
  const clean = React.useMemo(() => (inBrowser ? sanitizeLessonHtml(html) : ""), [inBrowser, html])
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}
