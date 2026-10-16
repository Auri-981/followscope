"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { CategoryKey, ComparedAccount, ComparisonResult } from "@/domain/types";
import { downloadFile } from "@/export/download";
import {
  CATEGORY_LABELS,
  exportAllCsv,
  exportAllJson,
  exportCategoryCsv,
  exportCategoryJson,
  exportSummaryCsv,
  exportSummaryJson,
  type ExportContext,
} from "@/export/exporters";
import type { CsvSeparator } from "@/export/csv";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

type Scope = "all" | "category" | "filtered" | "summary";

export function ExportDialog({
  open,
  onOpenChange,
  ctx,
  result,
  category,
  filtered,
  filterLabel,
  separator,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: ExportContext;
  result: ComparisonResult;
  category: CategoryKey;
  filtered: ComparedAccount[];
  filterLabel?: string;
  separator: CsvSeparator;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const isFiltered = Boolean(filterLabel);

  const options: { value: Scope; label: string; detail: string; disabled?: boolean }[] = [
    { value: "all", label: "Todas las categorías", detail: `${formatNumber(result.mutualCount + result.notFollowingBackCount + result.followsYouOnlyCount)} cuentas` },
    { value: "category", label: `Solo «${CATEGORY_LABELS[category]}»`, detail: `${formatNumber(result[category].length)} cuentas` },
    {
      value: "filtered",
      label: "Categoría actual con los filtros aplicados",
      detail: isFiltered ? `${formatNumber(filtered.length)} cuentas · ${filterLabel}` : "No hay filtros activos",
      disabled: !isFiltered,
    },
    { value: "summary", label: "Resumen estadístico", detail: "Recuentos y fechas, sin listas de cuentas" },
  ];

  const download = () => {
    const file =
      scope === "all"
        ? format === "csv"
          ? exportAllCsv(ctx, result, separator)
          : exportAllJson(ctx, result)
        : scope === "summary"
          ? format === "csv"
            ? exportSummaryCsv(ctx, result, separator)
            : exportSummaryJson(ctx, result)
          : (() => {
              const accounts = scope === "filtered" ? filtered : result[category];
              const filtering = scope === "filtered";
              return format === "csv"
                ? exportCategoryCsv(ctx, category, accounts, separator, filtering)
                : exportCategoryJson(ctx, category, accounts, filtering ? filterLabel : undefined);
            })();
    downloadFile(file);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Exportar resultados"
      description="El archivo se genera en tu navegador. No incluye credenciales ni identificadores internos."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={download} data-testid="confirm-export">
            <Download className="h-4 w-4" aria-hidden /> Descargar {format.toUpperCase()}
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Qué exportar</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
              scope === o.value ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2",
              o.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name="scope"
              value={o.value}
              checked={scope === o.value}
              disabled={o.disabled}
              onChange={() => setScope(o.value)}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="block text-xs text-muted">{o.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">Formato</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["csv", "json"] as const).map((f) => (
            <label
              key={f}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium",
                format === f ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-surface-2",
              )}
            >
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
              {f === "csv" ? "CSV (hojas de cálculo)" : "JSON"}
            </label>
          ))}
        </div>
        {format === "json" && scope === "all" ? (
          <p className="mt-2 text-xs text-muted">Este archivo se puede volver a importar en FollowScope para recuperar el análisis.</p>
        ) : null}
        {format === "csv" ? <p className="mt-2 text-xs text-muted">Separador: «{separator}». Puedes cambiarlo en Ajustes.</p> : null}
      </fieldset>
    </Dialog>
  );
}
