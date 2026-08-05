import type { Metadata, Viewport } from "next";
import { Public_Sans, Dancing_Script, Poppins } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'});

// Certificate-only script face for the printed recipient name — a sanctioned
// print-artifact exception; the UI itself is Poppins + Public Sans only.
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-cursive',
  weight: ['400', '500', '600', '700'],
});

// Display/brand voice in the WorldStreet design system — headlines lead with
// Poppins, body and labels stay Public Sans.
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

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
  title: {
    default: "WorldStreet Academy",
    template: "%s | WorldStreet Academy",
  },
  description:
    "Learn cryptocurrency trading, DeFi, risk management, and blockchain development from industry experts.",
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
      {/* data-ws-theme selects the Academy's palette from the shared design
          tokens. DS v2 (2026-08-05): stone ladder #0C0A09 + gold #EAB308, dark default
          (not the `shell` stone + #EAB308 used by wallet/auth). */}
      <html
        lang="en"
        className={publicSans.variable}
        data-ws-theme="platform"
        suppressHydrationWarning
      >
        <body
          className={`${dancingScript.variable} ${poppins.variable} antialiased`}
        >
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
