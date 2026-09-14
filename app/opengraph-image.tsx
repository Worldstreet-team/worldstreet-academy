import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { BRAND } from "@/lib/brand"

/**
 * Site-wide share card (1200×630): the brand lockup on the stone page. Every
 * route inherits it unless its metadata sets `openGraph` itself — a program
 * with a thumbnail does (app/(marketing)/programs/[slug]/page.tsx).
 *
 * Satori renders outside the CSS cascade, so the DS v2 tokens are literals
 * here, each named after its token in design-tokens/tokens.css (dark mode).
 * Type is next/og's bundled Noto Sans: no font is fetched at build time.
 */

export const alt = BRAND.name
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const PAGE = "#0C0A09" // --background (stone page)
const INK = "#FBFAF9" // --foreground, oklch(0.986 0.002 67.8)
const MUTED = "#A8A29E" // --muted-foreground
const GOLD = "#EAB308" // --primary (gold)

export default async function OpengraphImage() {
  // public/brand/wsa-mark.png is 206×118; the lockup renders it contained, so keep that ratio.
  const mark = await readFile(join(process.cwd(), "public/brand/wsa-mark.png"))
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: PAGE,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- metadata route (ImageResponse/Satori), not a browser <img>; the rule's own opengraph-image bypass fails to match on a Windows absolute path (non-global path.sep replace). */}
          <img src={markSrc} width={140} height={80} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 46, color: INK, letterSpacing: -1 }}>{BRAND.wordmark}</div>
            <div style={{ fontSize: 22, color: GOLD, letterSpacing: 5, textTransform: "uppercase" }}>
              {BRAND.eyebrow}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ maxWidth: 960, fontSize: 68, lineHeight: 1.1, color: INK, letterSpacing: -2 }}>
            {BRAND.tagline}
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: MUTED }}>{BRAND.name}</div>
        </div>
      </div>
    ),
    size
  )
}
