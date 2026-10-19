import { Camera, Music2, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { brand } from "@/config/brand";
import type { Platform } from "@/domain/types";
import { cn } from "@/lib/cn";

/**
 * Logotipo de FollowScope: tus seguidores y tus seguidos como dos círculos que
 * se cruzan, con la zona común (mutuos) resaltada; el círculo derecho es además
 * una lupa. Mismo dibujo que scripts/icon-design.mjs (versión de trazo grueso).
 */
export function Logo({ className, withName = true }: { className?: string; withName?: boolean }) {
  // Ids únicos por instancia: si dos logotipos comparten id y uno está oculto
  // (display: none), el navegador no resuelve el degradado del otro.
  const uid = `fs-logo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const bgId = `${uid}-bg`;
  const ringId = `${uid}-ring`;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 1024 1024" className="h-8 w-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
          <clipPath id={ringId}>
            <circle cx="395" cy="482" r="190" />
          </clipPath>
        </defs>
        <rect width="1024" height="1024" rx="288" fill={`url(#${bgId})`} />
        <circle cx="579" cy="482" r="190" fill="#c7d2fe" clipPath={`url(#${ringId})`} />
        <line x1="731" y1="634" x2="820" y2="723" stroke="white" strokeWidth="86" strokeLinecap="round" />
        <circle cx="395" cy="482" r="190" fill="none" stroke="white" strokeWidth="78" />
        <circle cx="579" cy="482" r="190" fill="none" stroke="white" strokeWidth="78" />
      </svg>
      {withName ? <span className="text-[17px] font-semibold tracking-tight">{brand.name}</span> : null}
    </span>
  );
}

export const platformMeta: Record<Platform, { label: string; icon: LucideIcon; tone: "instagram" | "tiktok"; href: string }> = {
  instagram: { label: "Instagram", icon: Camera, tone: "instagram", href: "/instagram" },
  tiktok: { label: "TikTok", icon: Music2, tone: "tiktok", href: "/tiktok" },
};

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const meta = platformMeta[platform];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        platform === "instagram" ? "bg-instagram-soft text-instagram" : "bg-tiktok-soft text-tiktok",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
