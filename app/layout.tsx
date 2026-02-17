import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Public_Sans, Dancing_Script } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-cursive',
  weight: ['400', '500', '600', '700'],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: "resizes-content",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      domain="worldstreetgold.com"
      isSatellite={true}
      signInUrl="https://www.worldstreetgold.com/login"
      signUpUrl="https://www.worldstreetgold.com/register"
      signInFallbackRedirectUrl="https://academy.worldstreetgold.com/dashboard"
      signUpFallbackRedirectUrl="https://academy.worldstreetgold.com/dashboard"
    >
      <html lang="en" className={publicSans.variable} suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
