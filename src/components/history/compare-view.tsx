"use client";

import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { platformMeta } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Spinner } from "@/components/ui/primitives";
import { diffSnapshots, type SnapshotDiff } from "@/domain/diff";
import type { RelationEntry } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
import { useAppState, type LoadedAnalysis } from "@/state/app-state";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; diff: SnapshotDiff; a: LoadedAnalysis; b: LoadedAnalysis };

function Delta({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", value > 0 ? "text-success" : value < 0 ? "text-danger" : "")}>
        {value > 0 ? "+" : ""}
        {formatNumber(value)}
      </p>
    </div>
  );
}

function ChangeList({ title, description, accounts, kind }: { title: string; description: string; accounts: RelationEntry[]; kind: "add" | "remove" }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? accounts : accounts.slice(0, 50);
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2">{title} <Badge tone={kind === "add" ? "success" : "danger"}>{formatNumber(accounts.length)}</Badge></span>} description={description} />
      <CardBody>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted">Sin cambios.</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {visible.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium hover:underline",
                      kind === "add" ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                    )}
                  >
                    {kind === "add" ? <Plus className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}@{a.username}
                  </a>
                </li>
              ))}
            </ul>
            {accounts.length > visible.length ? (
              <button type="button" onClick={() => setExpanded(true)} className="mt-3 text-sm font-medium text-primary hover:underline">
                Mostrar las {formatNumber(accounts.length)}
              </button>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function CompareView() {
  const params = useSearchParams();
  const { getAnalysis } = useAppState();
  const [state, setState] = useState<State>({ status: "loading" });
  const aId = params.get("a") ?? "";
  const bId = params.get("b") ?? "";

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAnalysis(aId), getAnalysis(bId)]).then(([a, b]) => {
      if (cancelled) return;
      if (!a || !b) return setState({ status: "error", message: "No se encuentran los análisis seleccionados." });
      if (!a.record.snapshot || !b.record.snapshot) {
        return setState({ status: "error", message: "Alguno de los análisis se guardó solo como resumen, sin listas, y no se puede comparar." });
      }
      const diff = diffSnapshots(a.record.snapshot, b.record.snapshot);
      if ("refused" in diff) {
        return setState({ status: "error", message: "Solo se pueden comparar análisis de la misma cuenta y plataforma." });
      }
      setState({ status: "ready", diff, a, b });
    });
    return () => {
      cancelled = true;
    };
  }, [aId, bId, getAnalysis]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
        <Spinner /> Comparando análisis…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <EmptyState title="No se puede comparar" action={<ButtonLink href="/history">Volver al historial</ButtonLink>}>
          {state.message}
        </EmptyState>
      </Card>
    );
  }

  const { diff, a } = state;
  const meta = platformMeta[a.record.platform];
  const range = `entre el ${formatDate(diff.fromDate)} y el ${formatDate(diff.toDate)}`;

  return (
    <div className="animate-fade-in space-y-6">
      <ButtonLink href="/history" variant="ghost" size="sm" className="-ml-2">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Historial
      </ButtonLink>
      <PageHeader
        eyebrow={<Badge tone={meta.tone}>{meta.label}</Badge>}
        title={`Cambios de @${a.record.accountUsername}`}
        description={`Diferencias observadas ${range}.`}
      />

      {!diff.reliable ? (
        <Alert tone="warning" title="Comparación con limitaciones">
          Al menos uno de los dos análisis tiene datos incompletos o con avisos. Algunas diferencias pueden deberse a listas incompletas y no a cambios
          reales.
        </Alert>
      ) : null}
      <Alert tone="info">
        Estas son diferencias entre dos exportaciones, no acciones confirmadas por {meta.label}. Solo sabemos que ocurrieron {range}, no cuándo
        exactamente. Una cuenta que «ya no aparece» puede haber dejado de seguirte, haberse desactivado o haber cambiado de nombre.
      </Alert>

      <Card>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Delta label="Seguidores" value={diff.categoryDelta.followers} />
            <Delta label="Seguidos" value={diff.categoryDelta.following} />
            <Delta label="Mutuos" value={diff.categoryDelta.mutual} />
            <Delta label="No te siguen" value={diff.categoryDelta.notFollowingBack} />
            <Delta label="Te siguen (no sigues)" value={diff.categoryDelta.followsYouOnly} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Relaciones mutuas: {formatNumber(diff.newMutuals.length)} nuevas, {formatNumber(diff.lostMutuals.length)} que ya no lo son.
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChangeList title="Nuevos seguidores" description="Aparecen en la lista de seguidores más reciente." accounts={diff.newFollowers} kind="add" />
        <ChangeList title="Ya no aparecen entre tus seguidores" description="Estaban en la lista anterior y no en la nueva." accounts={diff.missingFollowers} kind="remove" />
        <ChangeList title="Nuevas cuentas seguidas" description="Empezaste a seguirlas en este periodo." accounts={diff.newFollowing} kind="add" />
        <ChangeList title="Cuentas que ya no sigues" description="Estaban en tu lista de seguidos anterior." accounts={diff.removedFollowing} kind="remove" />
      </div>
    </div>
  );
}
