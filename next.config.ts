import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./src/config/security";

const isDev = process.env.NODE_ENV !== "production";

/**
 * STATIC_EXPORT=true genera una web estática en `out/` (para GitHub Pages u
 * otro alojamiento sin servidor). BASE_PATH indica el subdirectorio en el que
 * se publica, p. ej. "/followscope". Ver scripts/deploy-pages.mjs.
 */
const staticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.BASE_PATH ?? "";

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev: isDev, meta: false }) },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC_EXPORT: staticExport ? "true" : "false",
  },
  ...(staticExport
    ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
    : {
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
