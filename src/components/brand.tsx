import { Camera, Music2, type LucideIcon } from "lucide-react";
import { brand } from "@/config/brand";
import type { Platform } from "@/domain/types";
import { cn } from "@/lib/cn";

/** Logotipo propio de FollowScope: dos círculos que se solapan (intersección). */
export function Logo({ className, withName = true }: { className?: string; withName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="white" strokeWidth="2.2" />
        <circle cx="19.5" cy="16" r="6.5" fill="none" stroke="white" strokeOpacity="0.75" strokeWidth="2.2" />
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
