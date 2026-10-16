"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy, ExternalLink, Search, User, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Badge, EmptyState, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { CategoryKey, ComparedAccount, Platform } from "@/domain/types";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { categoryMeta, relevantDate } from "./category-meta";

export type SortKey = "az" | "za" | "recent" | "oldest";

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const ROW_HEIGHT = 68;

export interface FilterState {
  query: string;
  sort: SortKey;
}

/** Filtra y ordena sin tocar el array original. Coste O(n) + O(n log n) del orden. */
export function filterAccounts(accounts: readonly ComparedAccount[], category: CategoryKey, { query, sort }: FilterState): ComparedAccount[] {
  const q = query.trim().replace(/^@/, "").toLowerCase();
  const filtered = q
    ? accounts.filter((a) => a.username.toLowerCase().includes(q) || (a.displayName?.toLowerCase().includes(q) ?? false))
    : [...accounts];
  if (sort === "az") filtered.sort((a, b) => collator.compare(a.username, b.username));
  else if (sort === "za") filtered.sort((a, b) => collator.compare(b.username, a.username));
  else {
    const dir = sort === "recent" ? -1 : 1;
    filtered.sort((a, b) => {
      const da = relevantDate(category, a);
      const db = relevantDate(category, b);
      if (da === db) return collator.compare(a.username, b.username);
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -dir : dir;
    });
  }
  return filtered;
}

function dateLine(category: CategoryKey, a: ComparedAccount): string | undefined {
  const parts: string[] = [];
  if (a.followerSince && category !== "notFollowingBack") parts.push(`te sigue desde ${formatDate(a.followerSince)}`);
  if (a.followingSince && category !== "followsYouOnly") parts.push(`la sigues desde ${formatDate(a.followingSince)}`);
  return parts.length ? parts.join(" · ") : undefined;
}

export function AccountList({
  accounts,
  category,
  platform,
  onFilteredChange,
}: {
  accounts: readonly ComparedAccount[];
  category: CategoryKey;
  platform: Platform;
  onFilteredChange?: (filtered: ComparedAccount[], filter: FilterState) => void;
}) {
  const toast = useToast();
  const meta = categoryMeta[category];
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("az");
  const deferredQuery = useDeferredValue(query);
  const hasDates = useMemo(() => accounts.some((a) => relevantDate(category, a)), [accounts, category]);
  const filtered = useMemo(() => filterAccounts(accounts, category, { query: deferredQuery, sort }), [accounts, category, deferredQuery, sort]);

  useEffect(() => {
    onFilteredChange?.(filtered, { query: deferredQuery, sort });
  }, [filtered, deferredQuery, sort, onFilteredChange]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: filtered.length, getScrollElement: () => parentRef.current, estimateSize: () => ROW_HEIGHT, overscan: 12 });

  const copy = async (username: string) => {
    try {
      await navigator.clipboard.writeText(username);
      toast(`Copiado: @${username}`);
    } catch {
      toast("No se ha podido copiar", "danger");
    }
  };

  if (accounts.length === 0) {
    return <EmptyState icon={<meta.icon className="h-6 w-6" />} title={meta.emptyTitle}>{meta.emptyText}</EmptyState>;
  }

  const isFiltered = query.trim() !== "" || sort !== "az";
  const items = virtualizer.getVirtualItems();

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por usuario o nombre"
            className="pl-9"
            aria-label={`Buscar en ${meta.label}`}
          />
        </div>
        <div className="flex gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar" className="flex-1 sm:flex-none">
            <option value="az">Usuario A → Z</option>
            <option value="za">Usuario Z → A</option>
            {hasDates ? <option value="recent">Más recientes primero</option> : null}
            {hasDates ? <option value="oldest">Más antiguos primero</option> : null}
          </Select>
          {isFiltered ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSort("az");
              }}
              className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden /> Limpiar
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted" aria-live="polite" data-testid="match-count">
        {deferredQuery.trim()
          ? `${formatNumber(filtered.length)} de ${formatNumber(accounts.length)} cuentas coinciden`
          : `${formatNumber(accounts.length)} cuentas`}
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" />} title="Sin coincidencias" className="py-8">
          Ninguna cuenta coincide con «{query}».
        </EmptyState>
      ) : (
        <div ref={parentRef} className="max-h-[60vh] overflow-y-auto rounded-xl border border-border" role="list" aria-label={meta.label} data-testid="account-list">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {items.map((item) => {
              const a = filtered[item.index]!;
              const dates = dateLine(category, a);
              return (
                <div
                  key={a.id}
                  role="listitem"
                  className={cn("absolute inset-x-0 flex items-center gap-3 px-3 sm:px-4", item.index > 0 && "border-t border-border")}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      platform === "instagram" ? "bg-instagram-soft text-instagram" : "bg-tiktok-soft text-tiktok",
                    )}
                    aria-hidden
                  >
                    <User className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      <span className="truncate">@{a.username}</span>
                      <Badge tone={meta.tone} className="hidden shrink-0 sm:inline-flex">
                        {meta.short}
                      </Badge>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {a.displayName ?? ""}
                      {a.displayName && dates ? " · " : ""}
                      {dates ?? (a.displayName ? "" : "Sin nombre visible en la exportación")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copy(a.username)}
                      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
                      aria-label={`Copiar el usuario ${a.username}`}
                      title="Copiar usuario"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    {a.profileUrl ? (
                      <a
                        href={a.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
                        aria-label={`Abrir el perfil de ${a.username} en una pestaña nueva`}
                        title="Abrir perfil"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
