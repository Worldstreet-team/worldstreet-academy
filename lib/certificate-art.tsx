import "server-only"

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { BRAND } from "@/lib/brand"
import { CERT_TIER_TITLE, type CertificateTier } from "@/lib/certificate-tier"

/**
 * The certificate as one picture (owner, 2026-11-08: "better designed and in a
 * downloadable way"). The page shows it, and the PDF and PNG downloads are the
 * same render at print size, so what a learner sees is what they download.
 *
 * Satori renders outside the CSS cascade, so colours are literals named after
 * what they do. The paper is always light (a print artifact); the deep gold is
 * the brand gold darkened for legibility on paper, and the brand gold itself
 * (#EAB308) appears only as foil. Type: Manrope (the brand face) and Cormorant
 * Garamond italic for the holder's name, both SIL OFL, self-hosted under
 * public/fonts/certificate with their Latin, Latin Extended and Vietnamese
 * subsets, so names with ọ, ẹ or ṣ print. Layout units are on a 1754×1240
 * base (A4 landscape at 150 dpi) times `scale`.
 */

export type CertificateArt = {
  tier: CertificateTier
  holderName: string
  programName: string
  schoolName: string | null
  /** ISO instant; printed as its UTC day, the day /verify shows. */
  completedAt: string
  certificateId: string
  /** "academy.worldstreetgold.com/verify/WSA-…", or null for a legacy certificate that has no stored ID. */
  verifyLabel: string | null
  /** The holder's own signature (optional), as a data URL. */
  holderSignature: string | null
  /** Who issues it: the Academy, its signatory, or a marketplace instructor. */
  issuer: { label: string; name: string; signature: string | null }
}

export const CERT_BASE = { width: 1754, height: 1240 } as const

const PAPER = "#FBF8F1"
const INK = "#1C1917" // stone-900
const MUTED = "#6B645C"
const SUBTLE = "#9A9189"
const GOLD = "#B98A1E" // brand gold, darkened for print
const FOIL = "#EAB308" // brand gold

const FONT_DIR = join(process.cwd(), "public/fonts/certificate")
const SUBSETS = ["latin", "latin-ext", "vietnamese"] as const
type Weight = 300 | 500 | 600 | 700 | 800
type FontSpec = { name: string; data: ArrayBuffer; weight: Weight; style: "normal" | "italic" }

let fontsOnce: Promise<FontSpec[]> | null = null
let markOnce: Promise<string> | null = null

async function loadFonts(): Promise<FontSpec[]> {
  const specs: { file: string; name: string; weight: Weight; style: "normal" | "italic" }[] = []
  for (const sub of SUBSETS) {
    for (const weight of [300, 500, 600, 700, 800] as const) {
      specs.push({ file: `manrope-${sub}-${weight}-normal.woff`, name: "Manrope", weight, style: "normal" })
    }
    specs.push({ file: `cormorant-garamond-${sub}-600-italic.woff`, name: "Cormorant", weight: 600, style: "italic" })
  }
  return Promise.all(
    specs.map(async (s) => {
      const buf = await readFile(join(FONT_DIR, s.file))
      return { name: s.name, weight: s.weight, style: s.style, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer }
    })
  )
}

function fonts(): Promise<FontSpec[]> {
  fontsOnce ??= loadFonts().catch((err) => {
    fontsOnce = null
    throw err
  })
  return fontsOnce
}

/** public/brand/wsa-mark.png is 206×118. */
const MARK_RATIO = 206 / 118

function mark(): Promise<string> {
  markOnce ??= readFile(join(process.cwd(), "public/brand/wsa-mark.png"))
    .then((b) => `data:image/png;base64,${b.toString("base64")}`)
    .catch((err) => {
      markOnce = null
      throw err
    })
  return markOnce
}

const svg = (body: string, w: number, h: number) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  ).toString("base64")}`

/**
 * One side of the guilloche band between the outer rule and the inner
 * hairline: two mirrored waves that cross into a chain of loops, written out
 * as two plain paths. An SVG <pattern>, even at the strip's own size, cost as
 * much as the rest of the drawing (2026-11-08 timing); a path is cheap.
 */
function bandStrip(length: number, s: number, vertical: boolean): string {
  const t = 22 * s
  const mid = t / 2
  const tiles = Math.ceil(length / t)
  const wave = (crest: number) => {
    let d = `M0 ${mid}`
    for (let i = 0; i < tiles; i++) d += ` Q${i * t + t / 4} ${crest} ${i * t + mid} ${mid} T${(i + 1) * t} ${mid}`
    return `<path d="${d}" fill="none" stroke="${GOLD}" stroke-opacity=".38" stroke-width="${s}"/>`
  }
  const body = wave(0) + wave(t)
  // A vertical strip is the horizontal one turned a quarter: (x, y) → (t − y, x).
  return vertical
    ? svg(`<g transform="translate(${t} 0) rotate(90)">${body}</g>`, t, length)
    : svg(body, length, t)
}

/** A rule as four bars: Satori drew a bordered, canvas-sized box far slower than four filled ones. */
function rule(inset: number, thickness: number, color: string, W: number, H: number) {
  const bar = (left: number, top: number, width: number, height: number, key: string) => (
    <div key={key} style={{ display: "flex", position: "absolute", left, top, width, height, backgroundColor: color }} />
  )
  return [
    bar(inset, inset, W - 2 * inset, thickness, "t"),
    bar(inset, H - inset - thickness, W - 2 * inset, thickness, "b"),
    bar(inset, inset, thickness, H - 2 * inset, "l"),
    bar(W - inset - thickness, inset, thickness, H - 2 * inset, "r"),
  ]
}

/** The foil rosette: a 36-lobe scalloped disc with two rings. Text and mark are laid over it by Satori. */
function sealSvg(size: number): string {
  const c = size / 2
  const k = size / 230
  const lobes = 36
  let d = ""
  for (let i = 0; i <= lobes * 2; i++) {
    const a = (Math.PI * i) / lobes
    const r = (i % 2 === 0 ? 108 : 98) * k
    d += `${i ? "L" : "M"}${(c + Math.cos(a) * r).toFixed(2)} ${(c + Math.sin(a) * r).toFixed(2)}`
  }
  return svg(
    `<defs><radialGradient id="f" cx="38%" cy="32%" r="75%">` +
      `<stop offset="0" stop-color="#FDE68A"/><stop offset=".45" stop-color="${FOIL}"/><stop offset="1" stop-color="#A16207"/>` +
      `</radialGradient></defs>` +
      `<path d="${d}Z" fill="url(#f)"/>` +
      `<circle cx="${c}" cy="${c}" r="${86 * k}" fill="none" stroke="#FFF7D6" stroke-opacity=".75" stroke-width="${2 * k}"/>` +
      `<circle cx="${c}" cy="${c}" r="${78 * k}" fill="none" stroke="#7C4A03" stroke-opacity=".35" stroke-width="${1.2 * k}"/>` +
      `<circle cx="${c}" cy="${c}" r="${56 * k}" fill="#FFF9E8" fill-opacity=".18"/>`,
    size,
    size
  )
}

/** UTC day, "4 October 2026". */
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

/** Shrinks a line of `letters` set in `base` px to fit `room` px, given the face's average advance (em). */
function fit(letters: number, base: number, room: number, advance: number, min: number): number {
  const natural = letters * base * advance
  return natural <= room ? base : Math.max(min, Math.floor((base * room) / natural))
}

/**
 * Satori lays text out without mark positioning, so a combining accent with no
 * precomposed form (Yoruba ẹ̀, ọ́: a dotted vowel plus a tone mark) drifts off
 * its letter. After NFC, such a letter is drawn as its base with the spacing
 * form of the accent laid over it; every other letter stays plain text. A mark
 * with no spacing form here is left as typed. Spaces become no-break spaces:
 * Satori dropped one inside a long name, and the name is sized to one line.
 */
const SPACING_ACCENT: Record<string, string> = {
  "̀": "`",
  "́": "´",
  "̂": "^",
  "̃": "~",
  "̄": "¯",
  "̈": "¨",
}
type NameRun = { text: string } | { base: string; accent: string; upper: boolean }

function nameRuns(name: string): NameRun[] {
  const runs: NameRun[] = []
  let plain = ""
  const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" }).segment(name.normalize("NFC"))
  for (const { segment } of graphemes) {
    const marks = segment.match(/\p{M}/gu)
    const accents = marks?.map((m) => SPACING_ACCENT[m]).filter(Boolean) ?? []
    if (!marks || accents.length !== marks.length) {
      plain += segment.replace(/ /g, " ")
      continue
    }
    if (plain) runs.push({ text: plain })
    plain = ""
    const base = segment.replace(/\p{M}/gu, "")
    runs.push({ base, accent: accents.join(""), upper: base !== base.toLowerCase() })
  }
  if (plain) runs.push({ text: plain })
  return runs
}

/** Uppercase tracked line; the left padding re-centres it (tracking trails the last letter). */
function tracked(size: number, em: number) {
  return { fontSize: size, letterSpacing: size * em, paddingLeft: size * em, textTransform: "uppercase" as const }
}

/**
 * The certificate as PNG bytes, kept briefly in memory (2026-11-08): a print
 * render takes seconds, and the page fetches the print size ahead of a
 * download. Keyed on everything drawn plus the scale, so any change to the
 * name, tier, signature or wording draws afresh; identical requests in flight
 * share one render. Small: about a megabyte per print entry.
 */
const CACHE_LIMIT = 24
const rendered = new Map<string, Promise<ArrayBuffer>>()

export function certificatePng(art: CertificateArt, scale: number): Promise<ArrayBuffer> {
  const key = createHash("sha256").update(JSON.stringify([art, scale])).digest("hex")
  const hit = rendered.get(key)
  if (hit) {
    rendered.delete(key)
    rendered.set(key, hit)
    return hit
  }
  const work = renderCertificate(art, scale).then((res) => res.arrayBuffer())
  rendered.set(key, work)
  work.catch(() => rendered.delete(key))
  while (rendered.size > CACHE_LIMIT) {
    const oldest = rendered.keys().next().value
    if (oldest === undefined) break
    rendered.delete(oldest)
  }
  return work
}

async function renderCertificate(art: CertificateArt, scale: number) {
  const [fontList, markSrc] = await Promise.all([fonts(), mark()])
  const s = scale
  const W = CERT_BASE.width * s
  const H = CERT_BASE.height * s
  const [titleMain, titleSub] = CERT_TIER_TITLE[art.tier]

  const nameLetters = [...new Intl.Segmenter("und", { granularity: "grapheme" }).segment(art.holderName.normalize("NFC"))].length
  const nameSize = fit(nameLetters, 104, 1400, 0.47, 48)
  const nameRunsList = nameRuns(art.holderName)
  const programSize = fit(art.programName.length, 40, 1300, 0.6, 28)
  const holderSigned = Boolean(art.holderSignature)

  const block = (b: { signature: string | null; label: string; value: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 * s }}>
      <div style={{ display: "flex", height: 64 * s, width: 300 * s, alignItems: "flex-end", justifyContent: "center" }}>
        {b.signature ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori, not a browser <img>; the box letterboxes any signature shape
          <img src={b.signature} alt="" width={260 * s} height={64 * s} style={{ objectFit: "contain", objectPosition: "center bottom" }} />
        ) : null}
      </div>
      {/* The rule's alpha lives in the colour: Satori drew an empty, semi-opaque box as a dot. */}
      <div style={{ display: "flex", width: 300 * s, height: 2 * s, backgroundColor: "rgba(28,25,23,0.5)", marginTop: 6 * s }} />
      <div style={{ display: "flex", marginTop: 12 * s, fontWeight: 700, color: SUBTLE, ...tracked(12 * s, 0.3) }}>{b.label}</div>
      <div style={{ display: "flex", marginTop: 6 * s, fontSize: 18 * s, fontWeight: 600, color: INK, textAlign: "center" }}>{b.value}</div>
    </div>
  )

  const seal = 230 * s
  const band = 22 * s
  const sealMarkW = 84 * s

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: W,
          height: H,
          fontFamily: "Manrope",
          color: INK,
          backgroundColor: PAPER,
        }}
      >
        {/* Frame: outer rule, guilloche band, inner hairline */}
        {rule(44 * s, 3 * s, GOLD, W, H)}
        {[
          { x: 52 * s + band, y: 52 * s, len: W - 104 * s - 2 * band, vertical: false },
          { x: 52 * s + band, y: H - 52 * s - band, len: W - 104 * s - 2 * band, vertical: false },
          { x: 52 * s, y: 52 * s + band, len: H - 104 * s - 2 * band, vertical: true },
          { x: W - 52 * s - band, y: 52 * s + band, len: H - 104 * s - 2 * band, vertical: true },
        ].map((strip, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- Satori
          <img
            key={i}
            src={bandStrip(strip.len, s, strip.vertical)}
            alt=""
            width={strip.vertical ? band : strip.len}
            height={strip.vertical ? strip.len : band}
            style={{ position: "absolute", left: strip.x, top: strip.y }}
          />
        ))}
        {/* Foil diamonds where the band's strips meet */}
        {[
          [52 * s + band / 2, 52 * s + band / 2],
          [W - 52 * s - band / 2, 52 * s + band / 2],
          [52 * s + band / 2, H - 52 * s - band / 2],
          [W - 52 * s - band / 2, H - 52 * s - band / 2],
        ].map(([cx, cy], i) => (
          <div
            key={i}
            style={{
              display: "flex",
              position: "absolute",
              left: cx - 5 * s,
              top: cy - 5 * s,
              width: 10 * s,
              height: 10 * s,
              backgroundColor: FOIL,
              transform: "rotate(45deg)",
            }}
          />
        ))}
        {rule(76 * s, 1.5 * s, "rgba(185,138,30,0.35)", W, H)}

        {/* Watermark */}
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
        <img
          src={markSrc}
          alt=""
          width={760 * s}
          height={(760 / MARK_RATIO) * s}
          style={{ position: "absolute", left: (W - 760 * s) / 2, top: 420 * s, opacity: 0.045 }}
        />

        {/* The text column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "absolute",
            top: 110 * s,
            left: 150 * s,
            right: 150 * s,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
          <img src={markSrc} alt="" width={64 * MARK_RATIO * s} height={64 * s} />
          <div style={{ display: "flex", marginTop: 14 * s, fontWeight: 700, ...tracked(22 * s, 0.42) }}>{BRAND.name}</div>
          <div style={{ display: "flex", marginTop: 14 * s, fontWeight: 600, color: GOLD, ...tracked(13 * s, 0.38) }}>{BRAND.tagline}</div>

          <div style={{ display: "flex", marginTop: 58 * s, fontWeight: 300, lineHeight: 1, ...tracked(78 * s, 0.22) }}>{titleMain}</div>
          <div style={{ display: "flex", marginTop: 14 * s, fontWeight: 600, color: GOLD, ...tracked(18 * s, 0.5) }}>{titleSub}</div>

          <div style={{ display: "flex", marginTop: 56 * s, fontWeight: 500, color: MUTED, ...tracked(15 * s, 0.32) }}>This certifies that</div>
          <div
            style={{
              display: "flex",
              marginTop: 12 * s,
              fontFamily: "Cormorant",
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: nameSize * s,
              lineHeight: 1.05,
              textAlign: "center",
            }}
          >
            {nameRunsList.map((run, i) =>
              "text" in run ? (
                <div key={i} style={{ display: "flex" }}>
                  {run.text}
                </div>
              ) : (
                <div key={i} style={{ display: "flex", position: "relative" }}>
                  {run.base}
                  {/* A spacing accent sits at lowercase accent height on the base's baseline; capitals lift it to cap height. The nudge follows the italic slant. */}
                  <div
                    style={{
                      display: "flex",
                      position: "absolute",
                      left: 0.07 * nameSize * s,
                      right: 0,
                      top: (run.upper ? -0.2 : 0) * nameSize * s,
                      justifyContent: "center",
                    }}
                  >
                    {run.accent}
                  </div>
                </div>
              )
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 10 * s }}>
            <div style={{ display: "flex", width: 230 * s, height: 1.5 * s, backgroundImage: `linear-gradient(90deg, rgba(185,138,30,0), ${GOLD})` }} />
            <div style={{ display: "flex", width: 10 * s, height: 10 * s, margin: `0 ${14 * s}px`, backgroundColor: GOLD, transform: "rotate(45deg)" }} />
            <div style={{ display: "flex", width: 230 * s, height: 1.5 * s, backgroundImage: `linear-gradient(270deg, rgba(185,138,30,0), ${GOLD})` }} />
          </div>
          <div style={{ display: "flex", marginTop: 26 * s, fontSize: 18 * s, color: MUTED }}>has successfully completed the program</div>
          <div
            style={{
              display: "flex",
              marginTop: 10 * s,
              maxWidth: 1300 * s,
              fontWeight: 700,
              fontSize: programSize * s,
              letterSpacing: -0.01 * programSize * s,
              lineHeight: 1.15,
              textAlign: "center",
              justifyContent: "center",
            }}
          >
            {art.programName}
          </div>
          {art.schoolName ? (
            <div style={{ display: "flex", marginTop: 10 * s, fontWeight: 600, color: GOLD, ...tracked(14 * s, 0.3) }}>{art.schoolName}</div>
          ) : null}
        </div>

        {/* Foot: date (and the holder's signature), the seal, the issuer */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 150 * s,
            right: 150 * s,
            bottom: 132 * s,
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          {block({
            signature: art.holderSignature,
            label: holderSigned ? "Holder" : "Date of completion",
            value: dayLabel(art.completedAt),
          })}
          <div style={{ display: "flex", position: "relative", width: seal, height: seal }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
            <img src={sealSvg(seal)} alt="" width={seal} height={seal} style={{ position: "absolute", top: 0, left: 0 }} />
            <div style={{ display: "flex", position: "absolute", top: 64 * s, left: 0, width: seal, justifyContent: "center", fontWeight: 800, color: "#3B2503", ...tracked(13 * s, 0.3) }}>
              {BRAND.shortName}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
            <img
              src={markSrc}
              alt=""
              width={sealMarkW}
              height={sealMarkW / MARK_RATIO}
              style={{ position: "absolute", left: (seal - sealMarkW) / 2, top: 92 * s }}
            />
            <div style={{ display: "flex", position: "absolute", top: 150 * s, left: 0, width: seal, justifyContent: "center", fontWeight: 800, color: "#3B2503", ...tracked(13 * s, 0.23) }}>
              Verified
            </div>
          </div>
          {block({ signature: art.issuer.signature, label: art.issuer.label, value: art.issuer.name })}
        </div>

        {/* ID and where to verify it (spec §13) */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 92 * s,
            justifyContent: "center",
            fontSize: 13 * s,
            letterSpacing: 13 * s * 0.08,
            color: SUBTLE,
          }}
        >
          <span>Certificate ID&nbsp;</span>
          <span style={{ color: MUTED, fontWeight: 700 }}>{art.certificateId}</span>
          {art.verifyLabel ? <span>{`  ·  Verify at ${art.verifyLabel}`}</span> : null}
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fontList }
  )
}
