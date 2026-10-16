"use client";

import { ArrowRight, FlaskConical, RotateCcw, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { platformMeta, PlatformIcon } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, Badge, Card, CardBody, CardHeader, Input, PageHeader, Progress } from "@/components/ui/primitives";
import { normalizeUsername } from "@/domain/platforms";
import type { Platform } from "@/domain/types";
import type { ListKind } from "@/importers/types";
import { withBasePath } from "@/lib/base-path";
import { formatDateTime, formatNumber } from "@/lib/format";
import { officialProviders } from "@/providers/official-api-providers";
import { useAppState } from "@/state/app-state";
import { ExportInstructions } from "./export-instructions";
import { FileDropzone } from "./file-dropzone";
import { ImportPreview } from "./import-preview";

const DEMO_FILES: Record<Platform, { url: string; name: string }[]> = {
  instagram: [{ url: "/samples/instagram-export-ejemplo.zip", name: "instagram-export-ejemplo.zip" }],
  tiktok: [{ url: "/samples/tiktok/user_data_tiktok.json", name: "user_data_tiktok.json" }],
};
const DEMO_USERNAME = "demo_followscope";

const STAGE_LABEL = { reading: "Leyendo", extracting: "Extrayendo", parsing: "Validando", normalizing: "Normalizando" } as const;

function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function Step({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{n}</span>
            {title}
          </span>
        }
        description={description}
      />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export function PlatformWorkspace({ platform }: { platform: Platform }) {
  const router = useRouter();
  const meta = platformMeta[platform];
  const official = officialProviders[platform];
  const { drafts, setOwnerUsername, importDraft, cancelImport, resetDraft, analyze, latestAnalysis } = useAppState();
  const draft = drafts[platform];
  const outcome = draft.outcome;
  const usernameId = useId();
  const [touched, setTouched] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  const [gapDialog, setGapDialog] = useState<{ open: boolean; days: number }>({ open: false, days: 0 });
  const [demoError, setDemoError] = useState<string>();
  const latest = latestAnalysis(platform);

  const owner = normalizeUsername(platform, draft.ownerUsername);
  const ownerError = !owner.ok ? (owner.reason === "empty" ? "Escribe el nombre de usuario de la cuenta." : "El nombre de usuario no puede contener espacios.") : undefined;
  const importing = draft.status === "importing";

  const addFiles = (incoming: File[]) => {
    const merged = [...draft.files];
    for (const f of incoming) if (!merged.some((m) => sameFile(m, f))) merged.push(f);
    setAnalysisError(undefined);
    void importDraft(platform, merged, { kindOverrides: draft.kindOverrides, isDemo: false });
  };

  const removeFile = (index: number) => {
    const files = draft.files.filter((_, i) => i !== index);
    setAnalysisError(undefined);
    if (files.length === 0) resetDraft(platform);
    else void importDraft(platform, files, { kindOverrides: draft.kindOverrides, isDemo: draft.isDemo });
  };

  const chooseKind = (fileName: string, kind: ListKind) => {
    void importDraft(platform, draft.files, { kindOverrides: { ...draft.kindOverrides, [fileName]: kind }, isDemo: draft.isDemo });
  };

  const loadDemo = async () => {
    setDemoError(undefined);
    try {
      const files = await Promise.all(
        DEMO_FILES[platform].map(async ({ url, name }) => {
          const res = await fetch(withBasePath(url));
          if (!res.ok) throw new Error("demo_unavailable");
          return new File([await res.blob()], name, { lastModified: Date.now() });
        }),
      );
      setOwnerUsername(platform, DEMO_USERNAME);
      setAnalysisError(undefined);
      void importDraft(platform, files, { isDemo: true });
    } catch {
      setDemoError("No se han podido cargar los datos de demostración.");
    }
  };

  const runAnalysis = async (confirmDateGap = false) => {
    setTouched(true);
    if (!owner.ok || !outcome?.canCompare) return;
    setAnalyzing(true);
    setAnalysisError(undefined);
    try {
      const res = await analyze(platform, { confirmDateGap });
      if (res.ok) {
        router.push(`/analysis?id=${encodeURIComponent(res.id)}`);
        return;
      }
      if (res.code === "date_gap_needs_confirmation") setGapDialog({ open: true, days: res.gapDays });
      else setAnalysisError(res.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const canAnalyze = owner.ok && Boolean(outcome?.canCompare) && !importing;
  const disabledReason = importing
    ? "Espera a que termine la importación."
    : !outcome
      ? "Importa tus archivos para continuar."
      : !outcome.canCompare
        ? "Resuelve los problemas de la importación para continuar."
        : !owner.ok
          ? "Indica la cuenta analizada."
          : undefined;

  const progressValue = draft.progress && draft.progress.total > 0 ? (draft.progress.current / draft.progress.total) * 100 : undefined;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-3">
            <PlatformIcon platform={platform} />
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        }
        title={`Analizar ${meta.label}`}
        description="Importa la exportación oficial de tus datos y compara tus seguidores con las cuentas que sigues."
        actions={
          draft.files.length ? (
            <Button variant="ghost" onClick={() => resetDraft(platform)} disabled={importing}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Empezar de nuevo
            </Button>
          ) : null
        }
      />

      {/* Resumen del estado de la plataforma */}
      <Card className="mb-6">
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="text-xs text-muted">Cuenta</dt>
              <dd className="mt-1 truncate font-medium">{owner.ok ? `@${owner.display}` : "Sin indicar"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Estado de los datos</dt>
              <dd className="mt-1">
                {importing ? (
                  <Badge tone="info">Importando</Badge>
                ) : outcome?.canCompare ? (
                  outcome.incomplete ? (
                    <Badge tone="warning">Datos incompletos</Badge>
                  ) : (
                    <Badge tone="success">Listos</Badge>
                  )
                ) : outcome ? (
                  <Badge tone="danger">Con problemas</Badge>
                ) : draft.status === "cancelled" ? (
                  <Badge>Cancelado</Badge>
                ) : (
                  <Badge>Esperando importación</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Última importación</dt>
              <dd className="mt-1 text-sm">{draft.importedAt && outcome ? formatDateTime(draft.importedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Seguidores detectados</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums" data-testid="detected-followers">
                {outcome?.followers ? formatNumber(outcome.followers.entries.length) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Seguidos detectados</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums" data-testid="detected-following">
                {outcome?.following ? formatNumber(outcome.following.entries.length) : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4 text-xs">
            <Badge tone="success">Importación de archivos: disponible</Badge>
            <Badge title={official.listUnavailableReason}>{official.label}: no disponible</Badge>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="min-w-0 space-y-6">
          <Step n={1} title="Identifica la cuenta" description="El nombre de usuario de la cuenta cuyos datos vas a importar.">
            <label htmlFor={usernameId} className="sr-only">
              Nombre de usuario de {meta.label}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
              <Input
                id={usernameId}
                value={draft.ownerUsername}
                onChange={(e) => setOwnerUsername(platform, e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="tu_usuario"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="pl-7"
                aria-invalid={touched && !owner.ok}
                aria-describedby={`${usernameId}-hint`}
              />
            </div>
            <p id={`${usernameId}-hint`} className={touched && ownerError ? "mt-2 text-xs text-danger" : "mt-2 text-xs text-muted"}>
              {touched && ownerError ? ownerError : "Solo sirve para identificar el análisis. No se conecta con tu cuenta ni se pide contraseña."}
            </p>
          </Step>

          <Step n={2} title="Importa tus datos" description="Selecciona el ZIP de tu exportación o los archivos de seguidores y seguidos.">
            <div className="space-y-4">
              <FileDropzone files={draft.files} onAdd={addFiles} onRemove={removeFile} disabled={importing} />
              {importing ? (
                <div className="space-y-2 rounded-xl border border-border p-4" aria-live="polite">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {draft.progress ? `${STAGE_LABEL[draft.progress.stage]} ${draft.progress.fileName ?? ""}` : "Preparando…"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => cancelImport(platform)}>
                      Cancelar
                    </Button>
                  </div>
                  <Progress value={progressValue} label="Progreso de la importación" />
                  {draft.progress ? (
                    <p className="text-xs text-muted">
                      {Math.min(draft.progress.current, draft.progress.total)} de {draft.progress.total} archivo(s) procesados
                    </p>
                  ) : null}
                </div>
              ) : null}
              {draft.status === "cancelled" ? <Alert tone="info">Importación cancelada. Puedes volver a seleccionar los archivos.</Alert> : null}
              {draft.status === "failed" && draft.failure ? <Alert tone="danger" title="Error de importación">{draft.failure}</Alert> : null}
              <ExportInstructions platform={platform} />
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <Button variant="secondary" size="sm" onClick={loadDemo} disabled={importing}>
                  <FlaskConical className="h-4 w-4" aria-hidden /> Probar con datos de demostración
                </Button>
                <span className="text-xs text-muted">Cuentas ficticias, para ver cómo funciona.</span>
              </div>
              {demoError ? <Alert tone="danger">{demoError}</Alert> : null}
            </div>
          </Step>
        </div>

        <div className="min-w-0 space-y-6">
          <Step n={3} title="Revisa lo detectado" description="Comprueba que se han reconocido las dos listas antes de analizar.">
            {outcome ? (
              <ImportPreview outcome={outcome} onChooseKind={chooseKind} disabled={importing} />
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                {importing ? "Procesando archivos…" : "Aquí verás un resumen de los datos en cuanto selecciones tus archivos."}
              </div>
            )}
          </Step>

          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">4 · Analizar</h2>
                  <p className="text-sm text-muted" aria-live="polite">
                    {disabledReason ?? "Todo listo. El análisis se hace en tu navegador."}
                  </p>
                </div>
                <Button size="lg" onClick={() => runAnalysis(false)} disabled={!canAnalyze || analyzing} data-testid="analyze-button">
                  <ScanSearch className="h-4 w-4" aria-hidden />
                  {analyzing ? "Analizando…" : "Comparar listas"}
                </Button>
              </div>
              {analysisError ? <Alert tone="danger">{analysisError}</Alert> : null}
              {latest ? (
                <Link
                  href={`/analysis?id=${encodeURIComponent(latest.id)}`}
                  className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm hover:bg-border/60"
                >
                  <span>
                    Último resultado: <strong>@{latest.accountUsername}</strong> · {formatDateTime(latest.createdAt)}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={gapDialog.open}
        onOpenChange={(open) => setGapDialog((g) => ({ ...g, open }))}
        title="Las listas son de fechas distintas"
        description={`La lista de seguidores y la de seguidos se exportaron con ${gapDialog.days} días de diferencia. Algunas diferencias pueden deberse a cambios ocurridos entre ambas fechas.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setGapDialog((g) => ({ ...g, open: false }))}>
              Volver y cambiar archivos
            </Button>
            <Button
              onClick={() => {
                setGapDialog((g) => ({ ...g, open: false }));
                void runAnalysis(true);
              }}
            >
              Comparar igualmente
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {gapDialog.days > 30
            ? "Con un desfase tan grande, el resultado se marcará como «con limitaciones»."
            : "El resultado mostrará un aviso sobre este desfase."}
        </p>
      </Dialog>
    </div>
  );
}
