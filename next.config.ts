import type { NextConfig } from "next";

const r2AccountId = process.env.R2_ACCOUNT_ID?.trim();
const r2Origin = r2AccountId && /^[a-f0-9]{32}$/i.test(r2AccountId)
  ? ` https://${r2AccountId}.r2.cloudflarestorage.com` : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  // Permit only the configured R2 account for signed uploads and history images.
  `connect-src 'self' https://vercel.com https://*.private.blob.vercel-storage.com${r2Origin}${process.env.NODE_ENV === "development" ? " ws: wss: http: https:" : ""}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `img-src 'self' blob: data: https://*.private.blob.vercel-storage.com${r2Origin}`,
  "media-src 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // Allow the local iPhone/iPad to load Next's dev client and HMR assets
  // when testing over the Mac's LAN address.
  allowedDevOrigins: [process.env.DEV_ALLOWED_ORIGIN || "192.168.1.115"],
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/scratch/**",
          "**/backups/**",
          "**/.gemini/**",
          "**/outputs/**",
          "**/work/**",
        ],
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
