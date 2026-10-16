import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { brand } from "@/config/brand";
import { contentSecurityPolicy } from "@/config/security";
import { withBasePath } from "@/lib/base-path";
import { AppStateProvider } from "@/state/app-state";
import { themeBootScript } from "@/state/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${brand.name} · ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  icons: { apple: withBasePath("/icons/apple-touch-icon.png") },
};

// En la exportación estática no hay servidor que envíe cabeceras: la CSP va como <meta>.
const staticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e17" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {staticExport ? <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy({ dev: false, meta: true })} /> : null}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <AppStateProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
