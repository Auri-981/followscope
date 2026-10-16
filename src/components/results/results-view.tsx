"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft, Download, HardDrive, ScanSearch } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { platformMeta, PlatformIcon } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, EmptyState, PageHeader, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_KEYS, type CategoryKey, type ComparedAccount } from "@/domain/types";
import type { ExportContext } from "@/export/exporters";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAppState, type LoadedAnalysis } from "@/state/app-state";
import { AccountList, type FilterState } from "./account-list";
import { categoryMeta } from "./category-meta";
import { ExportDialog } from "./export-dialog";
import { CompositionBar, SummaryCards } from "./summary";

const TONE_TEXT = { mutual: "text-mutual", notback: "text-notback", youonly: "text-youonly" } as const;

function describeFilter(filter: FilterState): string | undefined {
  const parts: string[] = [];
  if (filter.query.trim()) parts.push(`búsqueda «${filter.query.trim()}»`);
  if (filter.sort !== "az") parts.push(filter.sort === "za" ? "orden Z→A" : filter.sort === "recent" ? "más recientes primero" : "más antiguos primero");
  return parts.length ? parts.join(", ") : undefined;
}

export function ResultsView() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { getAnalysis, saveAnalysis, session, settings } = useAppState();
  const toast = useToast();
  const [loaded, setLoaded] = useState<LoadedAnalysis | null | undefined>(undefined);
  const [category, setCategory] = useState<CategoryKey>("notFollowingBack");
  const [filtered, setFiltered] = useState<{ accounts: ComparedAccount[]; filter: FilterState }>({ accounts: [], filter: { query: "", sort: "az" } });
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAnalysis(id).then((res) => {
      if (!cancelled) setLoaded(res ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id, getAnalysis, session]);

  const onFilteredChange = useCallback((accounts: ComparedAccount[], filter: FilterState) => setFiltered({ accounts, filter }), []);

  if (loaded === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
        <Spinner /> Cargando análisis…
      </div>
    );
  }

  if (loaded === null) {
    return (
      <Card>
        <EmptyState
          icon={<ScanSearch className="h-6 w-6" />}
          title="No se encuentra este análisis"
          action={<ButtonLink href="/">Volver al inicio</ButtonLink>}
        >
          Puede que no se guardara en este dispositivo o que se haya borrado. Los análisis sin guardar desaparecen al cerrar o recargar la pestaña.
        </EmptyState>
      </Card>
    );
  }

  const { record, result } = loaded;
  const meta = platformMeta[record.platform];
  const capturedAt = record.snapshot?.capturedAt;
  const warnings = result?.warnings ?? record.warnings;
  const blocking = warnings.filter((w) => w.severity === "blocking");
  const otherWarnings = warnings.filter((w) => w.severity !== "blocking");
  const ctx: ExportContext | undefined = result
    ? { platform: record.platform, accountUsername: record.accountUsername, capturedAt: capturedAt ?? record.createdAt, comparedAt: result.comparedAt, isComplete: result.isComplete }
    : undefined;

  const save = async () => {
    setSaving(true);
    try {
      await saveAnalysis(record.id);
      setLoaded({ ...loaded, saved: true });
      toast("Análisis guardado en este dispositivo");
    } catch {
      toast("No se ha podido guardar el análisis", "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <ButtonLink href={meta.href} variant="ghost" size="sm" className="-ml-2">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {meta.label}
      </ButtonLink>

      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <PlatformIcon platform={record.platform} className="h-8 w-8" />
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {record.source === "demo" ? <Badge tone="primary">Datos de demostración</Badge> : <Badge>Importación de archivos</Badge>}
            {record.isComplete ? (
              <Badge tone="success" data-testid="completeness">Comparación completa</Badge>
            ) : (
              <Badge tone="warning" data-testid="completeness">Con limitaciones</Badge>
            )}
          </div>
        }
        title={`@${record.accountUsername}`}
        description={
          <>
            Datos del {capturedAt ? formatDateTime(capturedAt) : "momento de la importación"} · analizado el {formatDateTime(record.createdAt)}
          </>
        }
        actions={
          ctx && result?.invariantsHold ? (
            <Button variant="outline" onClick={() => setExportOpen(true)} data-testid="open-export">
              <Download className="h-4 w-4" aria-hidden /> Exportar
            </Button>
          ) : null
        }
      />

      {!loaded.saved ? (
        <Alert
          tone="info"
          title="Este análisis no está guardado"
          action={
            <Button size="sm" onClick={save} disabled={saving}>
              <HardDrive className="h-4 w-4" aria-hidden /> {saving ? "Guardando…" : "Guardar en este dispositivo"}
            </Button>
          }
        >
          Desaparecerá al cerrar o recargar la pestaña. Si lo guardas, se almacena solo en este navegador
          {settings.saveLists ? " (incluidas las listas, para poder compararlo más adelante)" : " (solo el resumen)"}.
        </Alert>
      ) : null}

      {result && !result.invariantsHold ? (
        <Alert tone="danger" title="Resultados no válidos">
          La comprobación interna de coherencia ha fallado, así que no se muestran los resultados. Vuelve a importar los archivos; si el problema
          persiste, puede que la exportación esté dañada.
        </Alert>
      ) : (
        <>
          {blocking.length || otherWarnings.length ? (
            <Alert tone={blocking.length || otherWarnings.some((w) => w.severity === "warning") ? "warning" : "info"} title="Limitaciones de estos datos">
              <ul className="list-disc space-y-1 pl-4">
                {[...blocking, ...otherWarnings].map((w) => (
                  <li key={`${w.code}-${w.message}`}>{w.message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <SummaryCards counts={record.counts} />
          <CompositionBar counts={record.counts} />

          {result ? (
            <Card>
              <Tabs.Root value={category} onValueChange={(v) => setCategory(v as CategoryKey)}>
                <Tabs.List className="grid grid-cols-3 gap-1 border-b border-border p-2" aria-label="Categorías">
                  {CATEGORY_KEYS.map((key) => {
                    const m = categoryMeta[key];
                    const Icon = m.icon;
                    return (
                      <Tabs.Trigger
                        key={key}
                        value={key}
                        data-testid={`tab-${key}`}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center text-xs font-medium text-muted transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:text-sm",
                          "hover:bg-surface-2 data-[state=active]:bg-surface-2 data-[state=active]:text-foreground",
                        )}
                      >
                        <Icon className={cn("h-4 w-4", TONE_TEXT[m.tone])} aria-hidden />
                        <span className="leading-tight">{m.label}</span>
                        <Badge tone={m.tone} className="tabular-nums">
                          {formatNumber(result[key].length)}
                        </Badge>
                      </Tabs.Trigger>
                    );
                  })}
                </Tabs.List>
                {CATEGORY_KEYS.map((key) => (
                  <Tabs.Content key={key} value={key} className="p-4 sm:p-5">
                    <p className="mb-4 text-sm text-muted">{categoryMeta[key].description}</p>
                    <AccountList accounts={result[key]} category={key} platform={record.platform} onFilteredChange={key === category ? onFilteredChange : undefined} />
                  </Tabs.Content>
                ))}
              </Tabs.Root>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <Alert tone="info" title="Solo se guardó el resumen">
                  Este análisis se guardó sin las listas de cuentas, así que solo están disponibles los recuentos (
                  {formatNumber(record.counts.followsYouOnlyCount)} cuentas te siguen y tú no les sigues).
                </Alert>
              </CardBody>
            </Card>
          )}

          <p className="text-xs text-muted">
            Los resultados reflejan las listas tal y como estaban al exportarlas. Que una cuenta aparezca en «No te siguen de vuelta» no confirma que
            haya dejado de seguirte en un momento concreto. FollowScope no sigue ni deja de seguir cuentas por ti.
          </p>
        </>
      )}

      {ctx && result ? (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          ctx={ctx}
          result={result}
          category={category}
          filtered={filtered.accounts}
          filterLabel={describeFilter(filtered.filter)}
          separator={settings.csvSeparator}
        />
      ) : null}
    </div>
  );
}
