"use client"

/**
 * Last resort, when the root layout itself fails (2026-11-12). It replaces the
 * whole document, so the site's stylesheet and fonts may be missing: the stone
 * and gold are inline literals here, named after their tokens.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          background: "#0C0A09", // --background (stone page)
          color: "#FBFAF9", // --foreground
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#A8A29E", marginTop: 8 }}>
            The Academy didn&apos;t load. Try again — if it keeps happening, come back in a few minutes.
          </p>
          {error.digest && <p style={{ fontSize: 11, color: "#78716C", marginTop: 8 }}>Ref: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 40,
              padding: "0 20px",
              borderRadius: 9999,
              border: 0,
              background: "#EAB308", // --primary (gold)
              color: "#0C0A09",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
