"use client";

import { GitCompare, History, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { platformMeta, PlatformIcon } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, Badge, Card, CardBody, EmptyState, PageHeader, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { AnalysisRecord, Platform } from "@/domain/types";
import { downloadFile } from "@/export/download";
import { exportHistoryCsv, exportHistoryJson } from "@/export/exporters";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAppState } from "@/state/app-state";

type Filter = "all" | Platform;

function sameAccount(a: AnalysisRecord, b: AnalysisRecord) {
  return a.platform === b.platform && a.accountUsername.toLowerCase() === b.accountUsername.toLowerCase();
}

export function HistoryView() {
  const router = useRouter();
  const toast = useToast();
  const { history, historyStatus, deleteAnalysis, clearHistory, settings } = useAppState();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<AnalysisRecord | "all" | null>(null);

  const records = useMemo(() => history.filter((r) => filter === "all" || r.platform === filter), [history, filter]);
  const selectedRecords = selected.map((id) => history.find((r) => r.id === id)).filter((r): r is AnalysisRecord => Boolean(r));
  const exportTarget = selectedRecords.length ? selectedRecords : records;

  const compareProblem =
    selectedRecords.length === 2
      ? !sameAccount(selectedRecords[0]!, selectedRecords[1]!)
        ? "Solo se pueden comparar análisis de la misma cuenta y plataforma."
        : undefined
      : undefined;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1]!, id] : [...prev, id]));

  const doDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete === "all") {
      await clearHistory();
      setSelected([]);
      toast("Historial borrado");
    } else {
      await deleteAnalysis(confirmDelete.id);
      setSelected((s) => s.filter((x) => x !== confirmDelete.id));
      toast("Análisis eliminado");
    }
    setConfirmDelete(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Historial de análisis"
        description="Análisis guardados en este navegador. Selecciona dos de la misma cuenta para ver qué ha cambiado."
        actions={
          history.length ? (
            <>
              <Button variant="outline" size="sm" onClick={() => downloadFile(exportHistoryCsv(exportTarget, settings.csvSeparator))}>
                Exportar CSV{selectedRecords.length ? ` (${selectedRecords.length})` : ""}
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadFile(exportHistoryJson(exportTarget))}>
                Exportar JSON{selectedRecords.length ? ` (${selectedRecords.length})` : ""}
              </Button>
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete("all")}>
                <Trash2 className="h-4 w-4" aria-hidden /> Borrar todo
              </Button>
            </>
          ) : null
        }
      />

      {historyStatus === "unavailable" ? (
        <Alert tone="warning" className="mb-4" title="Almacenamiento no disponible">
          Este navegador no permite guardar datos (por ejemplo, en modo privado). Los análisis solo durarán mientras la pestaña esté abierta.
        </Alert>
      ) : null}

      <div className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Filtrar por plataforma">
        {(["all", "instagram", "tiktok"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", filter === f ? "bg-primary-soft text-primary" : "text-muted hover:text-foreground")}
          >
            {f === "all" ? "Todas" : platformMeta[f].label}
          </button>
        ))}
      </div>

      {selectedRecords.length > 0 ? (
        <Card className="mb-4">
          <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              {selectedRecords.length === 1 ? "Selecciona otro análisis de la misma cuenta para compararlos." : (compareProblem ?? "Listo para comparar.")}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Quitar selección
              </Button>
              <Button
                size="sm"
                disabled={selectedRecords.length !== 2 || Boolean(compareProblem)}
                onClick={() => router.push(`/compare?a=${encodeURIComponent(selected[0]!)}&b=${encodeURIComponent(selected[1]!)}`)}
              >
                <GitCompare className="h-4 w-4" aria-hidden /> Comparar
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {historyStatus === "loading" ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner /> Cargando historial…
        </div>
      ) : records.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title={history.length ? "No hay análisis de esta plataforma" : "Tu historial está vacío"}
            action={!settings.autoSave ? <ButtonLink href="/settings" variant="outline">Ajustes de privacidad</ButtonLink> : undefined}
          >
            {settings.autoSave
              ? "Los próximos análisis se guardarán aquí automáticamente."
              : "Por privacidad, los análisis no se guardan salvo que lo pidas. Pulsa «Guardar en este dispositivo» en un resultado o activa el guardado automático."}
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => {
            const meta = platformMeta[r.platform];
            const canCompare = Boolean(r.snapshot);
            const checked = selected.includes(r.id);
            return (
              <li key={r.id}>
                <Card className={cn(checked && "border-primary")}>
                  <CardBody className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canCompare}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                        aria-label={`Seleccionar el análisis de @${r.accountUsername} del ${formatDateTime(r.createdAt)} para comparar`}
                        title={canCompare ? "Seleccionar para comparar" : "Guardado sin listas: no se puede comparar"}
                      />
                      <PlatformIcon platform={r.platform} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          @{r.accountUsername} <span className="font-normal text-muted">· {meta.label}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {formatDateTime(r.createdAt)}
                          {r.snapshot ? ` · datos del ${formatDateTime(r.snapshot.capturedAt)}` : ""}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {r.source === "demo" ? <Badge tone="primary">Demostración</Badge> : null}
                          {r.isComplete ? <Badge tone="success">Completo</Badge> : <Badge tone="warning">Con limitaciones</Badge>}
                          {!r.snapshot ? <Badge>Solo resumen</Badge> : null}
                        </div>
                      </div>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 text-center text-xs sm:w-80">
                      {[
                        ["Seguidores", r.counts.followerCount],
                        ["Seguidos", r.counts.followingCount],
                        ["Mutuos", r.counts.mutualCount],
                        ["No te siguen", r.counts.notFollowingBackCount],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-lg bg-surface-2 px-1 py-2">
                          <dt className="truncate text-muted">{label}</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">{formatNumber(value as number)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex gap-2 sm:flex-col">
                      <Link
                        href={`/analysis?id=${encodeURIComponent(r.id)}`}
                        className="inline-flex h-8 flex-1 items-center justify-center rounded-xl bg-surface-2 px-3 text-sm font-medium hover:bg-border/70"
                      >
                        Abrir
                      </Link>
                      <Button variant="ghost" size="sm" className="flex-1 text-danger" onClick={() => setConfirmDelete(r)} aria-label={`Eliminar el análisis de @${r.accountUsername}`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={confirmDelete === "all" ? "¿Borrar todo el historial?" : "¿Eliminar este análisis?"}
        description={
          confirmDelete === "all"
            ? "Se eliminarán todos los análisis guardados en este navegador. No se puede deshacer."
            : "Se eliminará de este navegador. No se puede deshacer."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={doDelete}>
              Eliminar
            </Button>
          </>
        }
      />
    </div>
  );
}
