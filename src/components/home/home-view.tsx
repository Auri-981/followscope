"use client";

import { ArrowRight, Download, FileUp, History, Lock, ScanSearch, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { platformMeta, PlatformIcon } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui/primitives";
import { brand } from "@/config/brand";
import { PLATFORMS, type AnalysisRecord, type Platform } from "@/domain/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAppState } from "@/state/app-state";

function PlatformCard({ platform }: { platform: Platform }) {
  const { drafts, latestAnalysis } = useAppState();
  const meta = platformMeta[platform];
  const draft = drafts[platform];
  const latest = latestAnalysis(platform);
  const outcome = draft.outcome;
  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={platform} />
          <div className="min-w-0">
            <h3 className="font-semibold">{meta.label}</h3>
            <p className="text-xs text-muted">Importación de la exportación oficial</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Datos</dt>
            <dd>
              {draft.status === "importing" ? (
                <Badge tone="info">Importando…</Badge>
              ) : outcome?.canCompare ? (
                <Badge tone="success">
                  {formatNumber(outcome.followers!.entries.length)} seguidores · {formatNumber(outcome.following!.entries.length)} seguidos
                </Badge>
              ) : outcome ? (
                <Badge tone="warning">Revisión pendiente</Badge>
              ) : (
                <Badge>Sin datos importados</Badge>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Último análisis</dt>
            <dd className="text-right">{latest ? formatDateTime(latest.createdAt) : "Ninguno"}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Conexión oficial</dt>
            <dd>
              <Badge>No disponible</Badge>
            </dd>
          </div>
        </dl>
        <ButtonLink href={meta.href} variant="outline" className="mt-auto w-full">
          Analizar {meta.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </CardBody>
    </Card>
  );
}

function LatestAnalysisCard({ record }: { record: AnalysisRecord }) {
  const meta = platformMeta[record.platform];
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PlatformIcon platform={record.platform} />
            <div>
              <p className="text-sm text-muted">Último análisis · {meta.label}</p>
              <p className="font-semibold">@{record.accountUsername}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {record.source === "demo" ? <Badge tone="primary">Datos de demostración</Badge> : null}
            {record.isComplete ? <Badge tone="success">Completo</Badge> : <Badge tone="warning">Con limitaciones</Badge>}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Seguidores", record.counts.followerCount],
            ["Seguidos", record.counts.followingCount],
            ["Mutuos", record.counts.mutualCount],
            ["No te siguen", record.counts.notFollowingBackCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(value as number)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{formatDateTime(record.createdAt)}</p>
          <ButtonLink href={`/analysis?id=${encodeURIComponent(record.id)}`} size="sm">
            Ver resultados
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}

const STEPS = [
  { icon: Download, title: "Exporta tus datos", text: "Pide tu archivo desde los ajustes oficiales de Instagram o TikTok." },
  { icon: FileUp, title: "Importa los archivos", text: "Arrástralos aquí. Se leen en tu navegador, sin subirse a ningún sitio." },
  { icon: ScanSearch, title: "Consulta los resultados", text: "Mira quién no te sigue de vuelta, quién sí y a quién no sigues tú." },
];

export function HomeView() {
  const { latestAnalysis } = useAppState();
  const latest = latestAnalysis();
  return (
    <div className="animate-fade-in space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-soft blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <Badge tone="primary" className="mb-4">
            <Lock className="h-3 w-3" aria-hidden /> Privado por diseño
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{brand.tagline}</h1>
          <p className="mt-3 text-base text-muted sm:text-lg">{brand.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="#plataformas" size="lg">
              Comenzar análisis
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/history" size="lg" variant="outline">
              <History className="h-4 w-4" aria-hidden />
              Historial
            </ButtonLink>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
            Nunca te pediremos la contraseña de tus redes sociales.
          </p>
        </div>
      </section>

      <section id="plataformas" aria-labelledby="plataformas-title" className="scroll-mt-20">
        <h2 id="plataformas-title" className="mb-4 text-lg font-semibold tracking-tight">
          Elige una plataforma
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PLATFORMS.map((p) => (
            <PlatformCard key={p} platform={p} />
          ))}
        </div>
      </section>

      <section aria-labelledby="ultimo-title">
        <h2 id="ultimo-title" className="mb-4 text-lg font-semibold tracking-tight">
          Tu actividad
        </h2>
        {latest ? (
          <LatestAnalysisCard record={latest} />
        ) : (
          <Card>
            <EmptyState icon={<ScanSearch className="h-6 w-6" />} title="Todavía no has hecho ningún análisis">
              Elige Instagram o TikTok, importa tu exportación y en unos segundos verás tus resultados. ¿Solo quieres probar? Dentro de cada plataforma
              puedes cargar datos de demostración.
            </EmptyState>
          </Card>
        )}
      </section>

      <section aria-labelledby="como-title">
        <h2 id="como-title" className="mb-4 text-lg font-semibold tracking-tight">
          Cómo funciona
        </h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Card className="h-full">
                <CardBody>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="text-xs font-medium text-muted">Paso {i + 1}</span>
                  </div>
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          ¿Por qué no basta con escribir un nombre de usuario? Las API oficiales no dan acceso a las listas de seguidores.{" "}
          <Link href="/settings#integraciones" className="font-medium text-primary hover:underline">
            Más información
          </Link>
        </p>
      </section>
    </div>
  );
}
