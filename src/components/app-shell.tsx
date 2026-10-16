"use client";

import { Camera, History, House, Monitor, Moon, Music2, Settings as SettingsIcon, ShieldCheck, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { useAppState } from "@/state/app-state";
import { Logo } from "./brand";

const NAV = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/instagram", label: "Instagram", icon: Camera },
  { href: "/tiktok", label: "TikTok", icon: Music2 },
  { href: "/history", label: "Historial", icon: History },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeToggle() {
  const { settings, updateSettings } = useAppState();
  const order = ["system", "light", "dark"] as const;
  const next = order[(order.indexOf(settings.theme) + 1) % order.length]!;
  const Icon = settings.theme === "dark" ? Moon : settings.theme === "light" ? Sun : Monitor;
  const label = { system: "Tema del sistema", light: "Tema claro", dark: "Tema oscuro" }[settings.theme];
  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: next })}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
      aria-label={`${label}. Cambiar tema`}
      title={label}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>

      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/" className="mb-8 px-2" aria-label={`${brand.name}, inicio`}>
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <span>Tus archivos se procesan en este navegador. No se suben a ningún servidor.</span>
          </div>
          <div className="flex items-center justify-between px-1">
            <Link href="/privacy" className="text-xs text-muted hover:text-foreground">
              Privacidad
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/85 px-4 backdrop-blur lg:hidden">
        <Link href="/" aria-label={`${brand.name}, inicio`}>
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main id="contenido" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
        <footer className="mx-auto mt-16 max-w-6xl border-t border-border pt-6 text-xs text-muted">
          <p>{brand.disclaimer}</p>
        </footer>
      </main>

      {/* Navegación inferior (móvil, accesible con una mano) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted")}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
