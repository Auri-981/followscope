"use client";

import type { Platform } from "@/domain/types";
import { importFiles, type ImportProgress } from "@/importers/pipeline";
import { ImportError, type ImportOutcome, type ListKind } from "@/importers/types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export interface RunImportOptions {
  platform: Platform;
  files: File[];
  kindOverrides?: Record<string, ListKind>;
  isDemo?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: ImportProgress) => void;
}

let nextId = 1;

function runInMainThread(options: RunImportOptions): Promise<ImportOutcome> {
  return importFiles({
    platform: options.platform,
    kindOverrides: options.kindOverrides,
    isDemo: options.isDemo,
    signal: options.signal,
    onProgress: options.onProgress,
    files: options.files.map((f) => ({ name: f.name, size: f.size, lastModified: f.lastModified, blob: f })),
  });
}

/**
 * Ejecuta la importación en un Web Worker (un worker nuevo por operación, que
 * se termina al acabar o al cancelar). Si el navegador no admite workers, se
 * usa el hilo principal con cancelación cooperativa.
 */
export function runImport(options: RunImportOptions): Promise<ImportOutcome> {
  if (typeof Worker === "undefined") return runInMainThread(options);

  return new Promise<ImportOutcome>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });
    } catch {
      runInMainThread(options).then(resolve, reject);
      return;
    }
    const id = nextId++;
    const cleanup = () => {
      worker.terminate();
      options.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new ImportError("cancelled", "Importación cancelada."));
    };
    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    options.signal?.addEventListener("abort", onAbort);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === "progress") options.onProgress?.(message.progress);
      else if (message.type === "done") {
        cleanup();
        resolve(message.outcome);
      } else {
        cleanup();
        reject(new ImportError(message.code, message.message));
      }
    };
    worker.onerror = () => {
      cleanup();
      // Si el worker no pudo arrancar (p. ej. política del navegador), se reintenta en el hilo principal.
      runInMainThread(options).then(resolve, reject);
    };
    const request: WorkerRequest = { id, platform: options.platform, files: options.files, kindOverrides: options.kindOverrides, isDemo: options.isDemo };
    worker.postMessage(request);
  });
}
