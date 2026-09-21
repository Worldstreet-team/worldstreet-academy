import * as React from "react"
import { wordsOf } from "./model"

/**
 * `text` with the start of every word a query word begins marked — the same
 * word-prefix rule the filter uses, so what is marked is why it matched.
 * Without tokens it is the plain string.
 */
export function Highlight({ text, tokens }: { text: string; tokens: readonly string[] }) {
  if (tokens.length === 0) return <>{text}</>
  const parts = text.split(/([\p{L}\p{N}]+)/u)
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0 || !part) return part
        const word = wordsOf(part)[0] ?? ""
        const hit = tokens.filter((t) => word.startsWith(t)).sort((a, b) => b.length - a.length)[0]
        if (!hit) return part
        return (
          <React.Fragment key={i}>
            <mark className="rounded-[3px] bg-ws-primary/[0.12] text-inherit [box-decoration-break:clone]">
              {part.slice(0, hit.length)}
            </mark>
            {part.slice(hit.length)}
          </React.Fragment>
        )
      })}
    </>
  )
}
