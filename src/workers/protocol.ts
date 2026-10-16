import type { Platform } from "@/domain/types";
import type { ImportProgress } from "@/importers/pipeline";
import type { ImportErrorCode, ImportOutcome, ListKind } from "@/importers/types";

export interface WorkerRequest {
  id: number;
  platform: Platform;
  files: File[];
  kindOverrides?: Record<string, ListKind>;
  isDemo?: boolean;
}

export type WorkerResponse =
  | { id: number; type: "progress"; progress: ImportProgress }
  | { id: number; type: "done"; outcome: ImportOutcome }
  | { id: number; type: "error"; code: ImportErrorCode; message: string };
