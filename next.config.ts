import type { NextConfig } from "next";

// MOCK_AUTH=1 (set by `pnpm dev:mock`) swaps Clerk for a local stub so the app
// runs without a Clerk instance. Off by default — production is untouched.
const mockAuth = process.env.MOCK_AUTH === "1";

const nextConfig: NextConfig = {
  ...(mockAuth
    ? {
        turbopack: {
          resolveAlias: {
            "@clerk/nextjs": "./mocks/clerk/index.tsx",
            "@clerk/nextjs/server": "./mocks/clerk/server.ts",
          },
        },
      }
    : {}),
  reactStrictMode: false,
  // The certificate picture (lib/certificate-art.tsx) reads its fonts and the
  // mark from public/ at runtime. The Docker image copies public/ whole; a
  // traced (standalone or serverless) build needs them declared.
  outputFileTracingIncludes: {
    // Keys are globs: "[courseId]" would read as a character class, so the segment is "*".
    "/dashboard/courses/*/certificate/image": ["./public/fonts/certificate/**", "./public/brand/wsa-mark.png"],
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        // R2 public bucket URLs (*.r2.dev or custom domain)
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        // Allow any custom domain for R2 (user can configure their own)
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
