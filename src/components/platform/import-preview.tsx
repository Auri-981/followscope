"use client";

import { CircleAlert, CircleCheck, CircleDashed, Ban } from "lucide-react";
import { Alert, Badge, Select } from "@/components/ui/primitives";
import type { DataWarning } from "@/domain/types";
import type { FileReport, ImportOutcome, ListKind, ListSummary } from "@/importers/types";
import { formatDate, formatNumber } from "@/lib/format";

function StatusIcon({ status }: { status: FileReport["status"] }) {
  if (status === "ok") return <CircleCheck className="h-4 w-4 text-success" aria-label="Correcto" />;
  if (status === "error") return <CircleAlert className="h-4 w-4 text-danger" aria-label="Error" />;
  if (status === "ignored") return <Ban className="h-4 w-4 text-muted" aria-label="Ignorado" />;
  return <CircleDashed className="h-4 w-4 text-warning" aria-label="Falta indicar el tipo" />;
}

function kindLabel(kind: FileReport["kind"]): string {
  return kind === "followers" ? "Seguidores" : kind === "following" ? "Seguidos" : "Sin determinar";
}

function ListCard({ title, list }: { title: string; list?: ListSummary }) {
  if (!list) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted">No detectada</p>
      </div>
    );
  }
  const sample = list.entries.slice(0, 5);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge tone="success">Detectada</Badge>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{formatNumber(list.entries.length)}</p>
      <p className="text-xs text-muted">
        cuentas únicas
        {list.duplicateCount ? ` · ${formatNumber(list.duplicateCount)} duplicadas` : ""}
        {list.invalidCount ? ` · ${formatNumber(list.invalidCount)} no válidas` : ""}
      </p>
      <p className="mt-2 text-xs text-muted">Fecha de los datos: {list.fileDate ? formatDate(list.fileDate) : "desconocida"}</p>
      {sample.length ? (
        <p className="mt-3 truncate text-xs text-muted" title={sample.map((s) => `@${s.username}`).join(", ")}>
          Vista previa: {sample.map((s) => `@${s.username}`).join(", ")}
          {list.entries.length > sample.length ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}

function WarningList({ warnings }: { warnings: DataWarning[] }) {
  if (!warnings.length) return null;
  const hasWarning = warnings.some((w) => w.severity !== "info");
  return (
    <Alert tone={hasWarning ? "warning" : "info"} title={hasWarning ? "Revisa estos avisos" : "Información sobre los datos"}>
      <ul className="list-disc space-y-1 pl-4">
        {warnings.map((w) => (
          <li key={`${w.code}-${w.message}`}>{w.message}</li>
        ))}
      </ul>
    </Alert>
  );
}

export function ImportPreview({
  outcome,
  onChooseKind,
  disabled,
}: {
  outcome: ImportOutcome;
  onChooseKind: (fileName: string, kind: ListKind) => void;
  disabled?: boolean;
}) {
  const warnings = [...outcome.warnings, ...(outcome.followers?.warnings ?? []), ...(outcome.following?.warnings ?? [])];
  const seen = new Set<string>();
  const uniqueWarnings = warnings.filter((w) => (seen.has(w.message) ? false : (seen.add(w.message), true)));

  return (
    <div className="space-y-4" data-testid="import-preview">
      {outcome.isDemo ? (
        <Alert tone="info" title="Datos de demostración">
          Estás usando cuentas ficticias incluidas en FollowScope. Los resultados se marcarán como demostración.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListCard title="Seguidores" list={outcome.followers} />
        <ListCard title="Seguidos" list={outcome.following} />
      </div>

      {outcome.errors.length ? (
        <Alert tone="danger" title="No se puede analizar todavía">
          <ul className="list-disc space-y-1 pl-4">
            {outcome.errors.map((e, i) => (
              <li key={`${e.code}-${i}`}>{e.message}</li>
            ))}
          </ul>
          {outcome.errors.some((e) => e.fileName) ? <p className="mt-2">Quita o sustituye los archivos con errores para continuar.</p> : null}
        </Alert>
      ) : null}

      <WarningList warnings={uniqueWarnings} />

      <div>
        <h3 className="mb-2 text-sm font-medium">Archivos analizados</h3>
        <ul className="divide-y divide-border rounded-xl border border-border text-sm">
          {outcome.files.map((f, i) => (
            <li key={`${f.fileName}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
              <StatusIcon status={f.status} />
              <span className="min-w-0 flex-1 break-all">{f.fileName}</span>
              {f.status === "ok" ? (
                <span className="text-xs text-muted">
                  {kindLabel(f.kind)} · {formatNumber(f.recordCount ?? 0)} registros
                </span>
              ) : null}
              {f.status === "needs_kind" ? (
                <label className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Contiene:</span>
                  <Select
                    className="h-8 text-xs"
                    defaultValue=""
                    disabled={disabled}
                    onChange={(e) => e.target.value && onChooseKind(f.fileName, e.target.value as ListKind)}
                    aria-label={`Tipo de lista de ${f.fileName}`}
                  >
                    <option value="" disabled>
                      Elige…
                    </option>
                    <option value="followers">Seguidores</option>
                    <option value="following">Seguidos</option>
                  </Select>
                </label>
              ) : null}
              {f.message && f.status !== "needs_kind" ? <p className="w-full pl-7 text-xs text-muted">{f.message}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
