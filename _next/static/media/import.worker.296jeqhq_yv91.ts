/// <reference lib="webworker" />
import { importFiles } from "@/importers/pipeline";
import { ImportError } from "@/importers/types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

/**
 * Worker de importación: lee, descomprime, valida y normaliza los archivos
 * fuera del hilo principal para que la interfaz siga respondiendo con listas
 * grandes. Cancelar = terminar el worker desde el cliente.
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, platform, files, kindOverrides, isDemo } = event.data;
  const post = (message: WorkerResponse) => ctx.postMessage(message);
  try {
    const outcome = await importFiles({
      platform,
      kindOverrides,
      isDemo,
      files: files.map((f) => ({ name: f.name, size: f.size, lastModified: f.lastModified, blob: f })),
      onProgress: (progress) => post({ id, type: "progress", progress }),
    });
    post({ id, type: "done", outcome });
  } catch (error) {
    const code = error instanceof ImportError ? error.code : "read_error";
    const message = error instanceof ImportError ? error.message : "Error inesperado al procesar los archivos.";
    post({ id, type: "error", code, message });
  }
};
