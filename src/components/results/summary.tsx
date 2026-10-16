import { UserCheck, Users, UserRound, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitives";
import type { ComparisonCounts } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatNumber, percent } from "@/lib/format";

function StatCard({ label, value, icon, tone, hint, testId }: { label: string; value: number; icon: ReactNode; tone: string; hint?: string; testId: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)} aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" data-testid={testId}>
        {formatNumber(value)}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function SummaryCards({ counts }: { counts: ComparisonCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard testId="stat-followers" label="Seguidores totales" value={counts.followerCount} icon={<Users className="h-4 w-4" />} tone="bg-primary-soft text-primary" />
      <StatCard testId="stat-following" label="Seguidos totales" value={counts.followingCount} icon={<UserRound className="h-4 w-4" />} tone="bg-surface-2 text-foreground" />
      <StatCard
        testId="stat-mutual"
        label="Seguimiento mutuo"
        value={counts.mutualCount}
        icon={<UserCheck className="h-4 w-4" />}
        tone="bg-mutual-soft text-mutual"
        hint={`${percent(counts.mutualCount, counts.followingCount)} % de tus seguidos`}
      />
      <StatCard
        testId="stat-notback"
        label="No te siguen de vuelta"
        value={counts.notFollowingBackCount}
        icon={<UserX className="h-4 w-4" />}
        tone="bg-notback-soft text-notback"
        hint={`${percent(counts.notFollowingBackCount, counts.followingCount)} % de tus seguidos`}
      />
    </div>
  );
}

/** Barra apilada con la composición real de F ∪ G en las tres categorías. */
export function CompositionBar({ counts }: { counts: ComparisonCounts }) {
  const total = counts.mutualCount + counts.notFollowingBackCount + counts.followsYouOnlyCount;
  const segments = [
    { key: "mutual", label: "Mutuos", value: counts.mutualCount, className: "bg-mutual", dot: "bg-mutual" },
    { key: "notback", label: "No te siguen de vuelta", value: counts.notFollowingBackCount, className: "bg-notback", dot: "bg-notback" },
    { key: "youonly", label: "Te siguen y no les sigues", value: counts.followsYouOnlyCount, className: "bg-youonly", dot: "bg-youonly" },
  ];
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Composición de tu red</h2>
        <p className="text-xs text-muted">{formatNumber(total)} cuentas distintas entre seguidores y seguidos</p>
      </div>
      <div
        className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${formatNumber(s.value)} (${percent(s.value, total)} %)`).join("; ")}
      >
        {total > 0
          ? segments.map((s) => (s.value > 0 ? <div key={s.key} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} /> : null))
          : null}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} aria-hidden />
            <span className="text-muted">{s.label}</span>
            <span className="font-medium tabular-nums">
              {formatNumber(s.value)} · {percent(s.value, total)} %
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
