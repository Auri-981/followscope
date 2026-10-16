"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { compareSnapshot } from "@/domain/compare";
import { normalizeUsername } from "@/domain/platforms";
import type { AnalysisRecord, ComparisonResult, Platform } from "@/domain/types";
import type { ImportProgress } from "@/importers/pipeline";
import { ImportError, type ImportOutcome, type ListKind } from "@/importers/types";
import { IndexedDbAnalysisRepository } from "@/persistence/indexeddb";
import { MemoryAnalysisRepository, type AnalysisRepository } from "@/persistence/repository";
import { FileImportProvider } from "@/providers/file-import-provider";
import { LOCAL_SPACE_ID, runAnalysis, summaryOnly, type AnalysisFailure } from "@/services/analysis";
import { runImport } from "@/workers/client";
import { applyTheme, defaultSettings, loadSettings, storeSettings, type Settings } from "./settings";

export type DraftStatus = "idle" | "importing" | "ready" | "cancelled" | "failed";

export interface PlatformDraft {
  ownerUsername: string;
  files: File[];
  kindOverrides: Record<string, ListKind>;
  status: DraftStatus;
  progress?: ImportProgress;
  outcome?: ImportOutcome;
  failure?: string;
  importedAt?: string;
  isDemo: boolean;
}

export interface LoadedAnalysis {
  record: AnalysisRecord;
  /** Ausente si el registro se guardó solo como resumen. */
  result?: ComparisonResult;
  saved: boolean;
}

export type HistoryStatus = "loading" | "ready" | "unavailable";

interface AppStateValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  drafts: Record<Platform, PlatformDraft>;
  setOwnerUsername: (platform: Platform, username: string) => void;
  importDraft: (platform: Platform, files: File[], options?: { kindOverrides?: Record<string, ListKind>; isDemo?: boolean }) => Promise<void>;
  cancelImport: (platform: Platform) => void;
  resetDraft: (platform: Platform) => void;
  analyze: (platform: Platform, options?: { confirmDateGap?: boolean }) => Promise<{ ok: true; id: string } | AnalysisFailure>;
  session: Record<string, LoadedAnalysis>;
  getAnalysis: (id: string) => Promise<LoadedAnalysis | undefined>;
  saveAnalysis: (id: string) => Promise<void>;
  history: AnalysisRecord[];
  historyStatus: HistoryStatus;
  deleteAnalysis: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  /** Último análisis conocido (sesión o historial), opcionalmente por plataforma. */
  latestAnalysis: (platform?: Platform) => AnalysisRecord | undefined;
}

const emptyDraft = (): PlatformDraft => ({ ownerUsername: "", files: [], kindOverrides: {}, status: "idle", isDemo: false });

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [drafts, setDrafts] = useState<Record<Platform, PlatformDraft>>({ instagram: emptyDraft(), tiktok: emptyDraft() });
  const [session, setSession] = useState<Record<string, LoadedAnalysis>>({});
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>("loading");
  const repoRef = useRef<AnalysisRepository | null>(null);
  const aborts = useRef<Partial<Record<Platform, AbortController>>>({});
  // Copias del estado para los callbacks asíncronos (se actualizan tras cada render).
  const draftsRef = useRef(drafts);
  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    draftsRef.current = drafts;
    sessionRef.current = session;
    settingsRef.current = settings;
  });

  const repo = useCallback((): AnalysisRepository => {
    if (!repoRef.current) {
      repoRef.current = typeof indexedDB !== "undefined" ? new IndexedDbAnalysisRepository() : new MemoryAnalysisRepository();
    }
    return repoRef.current;
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await repo().list(LOCAL_SPACE_ID));
      setHistoryStatus("ready");
    } catch {
      // IndexedDB bloqueado (p. ej. modo privado estricto): se usa memoria.
      repoRef.current = new MemoryAnalysisRepository();
      setHistory([]);
      setHistoryStatus("unavailable");
    }
  }, [repo]);

  useEffect(() => {
    // Las preferencias viven en localStorage, que no existe durante el prerenderizado:
    // se leen tras montar para no provocar diferencias de hidratación.
    const loaded = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loaded);
    applyTheme(loaded.theme);
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      storeSettings(next);
      if (patch.theme) applyTheme(next.theme);
      return next;
    });
  }, []);

  const patchDraft = useCallback((platform: Platform, patch: Partial<PlatformDraft> | ((d: PlatformDraft) => Partial<PlatformDraft>)) => {
    setDrafts((prev) => {
      const current = prev[platform];
      const delta = typeof patch === "function" ? patch(current) : patch;
      return { ...prev, [platform]: { ...current, ...delta } };
    });
  }, []);

  const setOwnerUsername = useCallback((platform: Platform, username: string) => patchDraft(platform, { ownerUsername: username }), [patchDraft]);

  const importDraft = useCallback<AppStateValue["importDraft"]>(
    async (platform, files, options = {}) => {
      aborts.current[platform]?.abort();
      const controller = new AbortController();
      aborts.current[platform] = controller;
      const kindOverrides = options.kindOverrides ?? {};
      const isDemo = Boolean(options.isDemo);
      patchDraft(platform, { files, kindOverrides, isDemo, status: files.length ? "importing" : "idle", progress: undefined, failure: undefined, outcome: undefined });
      if (files.length === 0) return;
      try {
        const outcome = await runImport({
          platform,
          files,
          kindOverrides,
          isDemo,
          signal: controller.signal,
          onProgress: (progress) => {
            if (!controller.signal.aborted) patchDraft(platform, { progress });
          },
        });
        if (controller.signal.aborted) return;
        patchDraft(platform, { status: "ready", outcome, progress: undefined, importedAt: new Date().toISOString() });
      } catch (error) {
        if (error instanceof ImportError && error.code === "cancelled") {
          patchDraft(platform, { status: "cancelled", progress: undefined });
          return;
        }
        patchDraft(platform, {
          status: "failed",
          progress: undefined,
          failure: error instanceof ImportError ? error.message : "No se han podido procesar los archivos.",
        });
      } finally {
        if (aborts.current[platform] === controller) delete aborts.current[platform];
      }
    },
    [patchDraft],
  );

  const cancelImport = useCallback((platform: Platform) => aborts.current[platform]?.abort(), []);

  const resetDraft = useCallback(
    (platform: Platform) => {
      aborts.current[platform]?.abort();
      patchDraft(platform, (d) => ({ ...emptyDraft(), ownerUsername: d.ownerUsername }));
    },
    [patchDraft],
  );

  const persist = useCallback(
    async (loaded: LoadedAnalysis) => {
      const s = settingsRef.current;
      await repo().save(LOCAL_SPACE_ID, s.saveLists ? loaded.record : summaryOnly(loaded.record));
      await refreshHistory();
    },
    [repo, refreshHistory],
  );

  const analyze = useCallback<AppStateValue["analyze"]>(
    async (platform, options = {}) => {
      const draft = draftsRef.current[platform];
      if (!draft.outcome?.canCompare) {
        return { ok: false, code: "provider_error", message: "Primero importa y valida las listas de seguidores y seguidos." };
      }
      const owner = normalizeUsername(platform, draft.ownerUsername);
      if (!owner.ok) return { ok: false, code: "invalid_owner", message: "Introduce un nombre de usuario válido para la cuenta analizada." };
      const provider = new FileImportProvider(draft.outcome, owner.display, draft.importedAt);
      const res = await runAnalysis(provider, { confirmDateGap: options.confirmDateGap, extraWarnings: draft.outcome.warnings });
      if (!res.ok) return res;
      const loaded: LoadedAnalysis = { record: res.bundle.record, result: res.bundle.result, saved: false };
      if (settingsRef.current.autoSave) {
        try {
          await persist(loaded);
          loaded.saved = true;
        } catch {
          // Si falla el guardado, el análisis sigue disponible en esta sesión.
        }
      }
      setSession((prev) => ({ ...prev, [loaded.record.id]: loaded }));
      return { ok: true, id: loaded.record.id };
    },
    [persist],
  );

  const getAnalysis = useCallback(
    async (id: string): Promise<LoadedAnalysis | undefined> => {
      const fromSession = sessionRef.current[id];
      if (fromSession) return fromSession;
      try {
        const record = await repo().get(LOCAL_SPACE_ID, id);
        if (!record) return undefined;
        return { record, result: record.snapshot ? compareSnapshot(record.snapshot, new Date(record.createdAt)) : undefined, saved: true };
      } catch {
        return undefined;
      }
    },
    [repo],
  );

  const saveAnalysis = useCallback(
    async (id: string) => {
      const loaded = sessionRef.current[id];
      if (!loaded || loaded.saved) return;
      await persist(loaded);
      setSession((prev) => ({ ...prev, [id]: { ...loaded, saved: true } }));
    },
    [persist],
  );

  const deleteAnalysis = useCallback(
    async (id: string) => {
      await repo().delete(LOCAL_SPACE_ID, id);
      setSession((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        next[id] = { ...next[id]!, saved: false };
        return next;
      });
      await refreshHistory();
    },
    [repo, refreshHistory],
  );

  const clearHistory = useCallback(async () => {
    await repo().clear(LOCAL_SPACE_ID);
    setSession({});
    await refreshHistory();
  }, [repo, refreshHistory]);

  const latestAnalysis = useCallback(
    (platform?: Platform) => {
      const all = [...Object.values(session).map((s) => s.record), ...history];
      return all
        .filter((r) => !platform || r.platform === platform)
        .reduce<AnalysisRecord | undefined>((best, r) => (!best || r.createdAt > best.createdAt ? r : best), undefined);
    },
    [session, history],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      settings,
      updateSettings,
      drafts,
      setOwnerUsername,
      importDraft,
      cancelImport,
      resetDraft,
      analyze,
      session,
      getAnalysis,
      saveAnalysis,
      history,
      historyStatus,
      deleteAnalysis,
      clearHistory,
      latestAnalysis,
    }),
    [settings, updateSettings, drafts, setOwnerUsername, importDraft, cancelImport, resetDraft, analyze, session, getAnalysis, saveAnalysis, history, historyStatus, deleteAnalysis, clearHistory, latestAnalysis],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
