import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
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
