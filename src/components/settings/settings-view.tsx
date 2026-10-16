"use client";

import { Plug, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PlatformIcon } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, Card, CardBody, CardHeader, PageHeader, Select, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { defaultLimits, formatBytes } from "@/config/limits";
import { PLATFORMS } from "@/domain/types";
import { formatNumber } from "@/lib/format";
import { officialProviders } from "@/providers/official-api-providers";
import { useAppState } from "@/state/app-state";
import type { Settings } from "@/state/settings";

export function SettingsView() {
  const { settings, updateSettings, history, clearHistory, resetDraft } = useAppState();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  const wipe = async () => {
    await clearHistory();
    PLATFORMS.forEach((p) => resetDraft(p));
    setConfirm(false);
    toast("Se han borrado todos los datos de FollowScope de este navegador");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Ajustes y privacidad" description="Controla qué se guarda en este dispositivo y cómo se exportan tus resultados." />

      <Card>
        <CardHeader title="Privacidad" description="Por defecto no se guarda nada: los análisis desaparecen al cerrar la pestaña." />
        <CardBody className="space-y-5">
          <Switch
            id="autosave"
            checked={settings.autoSave}
            onChange={(v) => updateSettings({ autoSave: v })}
            label="Guardar automáticamente los análisis en este dispositivo"
            description="Se almacenan solo en este navegador (IndexedDB). Nunca se envían a un servidor."
          />
          <Switch
            id="savelists"
            checked={settings.saveLists}
            onChange={(v) => updateSettings({ saveLists: v })}
            label="Incluir las listas de cuentas al guardar"
            description="Necesario para reabrir las listas y comparar análisis. Desactívalo para guardar solo los recuentos."
          />
          <div className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <p>
              Los archivos que importas se leen en tu navegador y no se guardan: solo se conservan las listas normalizadas si eliges guardar un análisis.{" "}
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                Política de privacidad
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Apariencia y exportación" />
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Tema</span>
            <Select className="mt-2 w-full" value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as Settings["theme"] })}>
              <option value="system">Según el sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </Select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Separador de CSV</span>
            <Select className="mt-2 w-full" value={settings.csvSeparator} onChange={(e) => updateSettings({ csvSeparator: e.target.value as Settings["csvSeparator"] })}>
              <option value=",">Coma (,) — estándar</option>
              <option value=";">Punto y coma (;) — Excel en español</option>
            </Select>
          </label>
        </CardBody>
      </Card>

      <Card id="integraciones" className="scroll-mt-20">
        <CardHeader title="Fuentes de datos" description="Estado real de cada vía de obtención de datos." />
        <CardBody className="space-y-4">
          {PLATFORMS.map((p) => {
            const official = officialProviders[p];
            return (
              <div key={p} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-start">
                <PlatformIcon platform={p} />
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Importación de la exportación oficial</span>
                    <Badge tone="success">Disponible</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{official.productName}</span>
                    <Badge>
                      <Plug className="h-3 w-3" aria-hidden /> No conectada
                    </Badge>
                  </div>
                  <p className="text-muted">{official.listUnavailableReason}</p>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted">FollowScope no usa scraping ni pide contraseñas. Las conexiones oficiales se activarán solo si las plataformas ofrecen acceso a las listas.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Límites de importación" description="Protegen tu navegador frente a archivos enormes o dañados." />
        <CardBody>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">Archivo JSON/CSV/TXT</dt>
              <dd className="mt-1 font-medium">{formatBytes(defaultLimits.maxFileBytes)}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">Fichero dentro de un ZIP</dt>
              <dd className="mt-1 font-medium">{formatBytes(defaultLimits.maxZipEntryBytes)}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">Cuentas por lista</dt>
              <dd className="mt-1 font-medium">{formatNumber(defaultLimits.maxRecords)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Borrar datos" />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Elimina el historial ({formatNumber(history.length)} análisis guardados) y los datos importados en esta sesión. Tus preferencias se mantienen.
          </p>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Borrar todos mis datos
          </Button>
        </CardBody>
      </Card>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Borrar todos tus datos?"
        description="Se eliminarán el historial y los datos importados de este navegador. No se puede deshacer."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={wipe}>
              Borrar
            </Button>
          </>
        }
      />
    </div>
  );
}
