import type { Metadata, Viewport } from "next";
import { Dancing_Script, Manrope, Noto_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import { IconDefs } from "@/ds/components/icon";
import { BRAND, SITE_DESCRIPTION } from "@/lib/brand";
import { APP_URL } from "@/lib/app-url";
import "./globals.css";

// The WorldStreet design system (2026-10-06): Manrope carries everything —
// variable, so the 300 hero weight is there. Replaces Poppins + Public Sans.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

// Certificate-only script face for the printed recipient name — a sanctioned
// print-artifact exception; the UI itself is Manrope only.
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-cursive',
  weight: ['400', '500', '600', '700'],
});

// design-system/02 ₦ glyph rule — the brand faces' Latin files carry no naira
// sign, so NGN amounts borrow it from Noto Sans at the money weights. U+20A6
// lives in Google's latin-ext face (unicode-range U+20A0-20AB); `subsets` only
// steers preloading, and nothing is preloaded: the face downloads only on a
// page that actually renders ₦.
const notoSans = Noto_Sans({
  subsets: ["latin-ext"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-noto",
  display: "swap",
  preload: false,
});

/**
 * Naira stacks for `NAIRA_FONT` (components/wallet/shared.tsx): brand face →
 * Noto → the brand face's full next/font list. Noto can't just follow
 * `var(--font-display)`: next/font ends that list with a size-adjusted local
 * Arial, and Arial carries ₦, so the glyph would render from Arial at the
 * wrong weight. `style.fontFamily` names the self-hosted face first.
 */
const primaryFace = (font: { style: { fontFamily: string } }) => font.style.fontFamily.split(",")[0];
const nairaStacks: React.CSSProperties = {
  ["--font-naira-display" as string]: `${primaryFace(manrope)}, ${primaryFace(notoSans)}, var(--font-display)`,
  ["--font-naira-sans" as string]: `${primaryFace(manrope)}, ${primaryFace(notoSans)}, var(--font-sans)`,
};

// No maximumScale: the design system bans blocking pinch-zoom (06-motion-a11y).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  // Required for env(safe-area-inset-*) to report real values. Without it iOS
  // letterboxes the page and every inset resolves to 0 — which silently
  // disabled the safe-area padding on the bottom navs, the meeting controls
  // and the side panel. Paired with the `.safe-area-*` helpers in globals.css.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  // Absolute base for og:image, canonical and share URLs (lib/app-url.ts — loopback is ignored in production).
  metadataBase: new URL(APP_URL),
  title: {
    default: BRAND.name,
    template: `%s | ${BRAND.name}`,
  },
  description: SITE_DESCRIPTION,
  // Every page inherits this card and app/opengraph-image.tsx unless its own metadata sets openGraph.
  openGraph: {
    siteName: BRAND.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/worldstreet-logo/WorldStreet1.png",
    apple: "/worldstreet-logo/WorldStreet1.png",
  },
};

// Detect local development vs production satellite mode
const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      {...(!isLocalDev
        ? {
            domain: "worldstreetgold.com",
            isSatellite: true,
            signInUrl: "https://www.worldstreetgold.com/login",
            signUpUrl: "https://www.worldstreetgold.com/register",
            signInFallbackRedirectUrl: "https://academy.worldstreetgold.com/dashboard",
            signUpFallbackRedirectUrl: "https://academy.worldstreetgold.com/dashboard",
          }
        : {
            signInUrl: "/login",
            signUpUrl: "/register",
            signInFallbackRedirectUrl: "/dashboard",
            signUpFallbackRedirectUrl: "/dashboard",
          })}
    >
      {/* The WorldStreet design system: data-theme (dark default, light
          supported) on <html> — next-themes keeps it in step — and
          data-brand on <body>, which re-colours the kit as WorldStreet
          (gold on stone). cx-root sets the kit's base type. */}
      <html lang="en" className={manrope.variable} data-theme="dark" suppressHydrationWarning>
        <body
          data-brand="worldstreet"
          className={`cx-root ${dancingScript.variable} ${notoSans.variable} antialiased`}
          style={nairaStacks}
        >
          {/* The icon set's gradients: SVG gradients resolve where they're defined. */}
          <IconDefs />
          <IconDefs brand="worldstreet" />
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
          {/* Vivid voice assistant — hosted widget, site-wide (marketing,
              dashboard, instructor, admin). The key is publishable; behavior
              (voice, knowledge, routes, guardrails, allowed origins) is
              configured in the Vivid dashboard, not in this repo.

              A plain async tag, not next/script: every next/script strategy
              defers the real tag to Next's client runtime, so a client-side
              error anywhere took the orb down with it. React hoists this into
              the SSR'd <head>, so the browser fetches it regardless of what
              our JS does. */}
          <script
            async
            src="https://platformvivid.worldstreetgold.com/widget.js"
            data-key="pk_live_UFtFcw9sZ0UNpoM8yZO80swv"
            data-api="https://platformvivid.worldstreetgold.com"
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
