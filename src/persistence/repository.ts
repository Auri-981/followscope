import { analysisRecordSchema, type AnalysisRecord, type Platform } from "@/domain/types";

/**
 * Capa de persistencia intercambiable. Todas las operaciones están acotadas a
 * un «espacio» (`spaceId`): en el MVP solo existe el espacio local del
 * navegador, pero una implementación con backend (p. ej. PostgreSQL/Supabase
 * con políticas RLS) usaría el id del usuario autenticado. Un registro nunca
 * se devuelve ni se borra desde un espacio distinto al suyo, aunque se conozca su id.
 */
export interface AnalysisRepository {
  save(spaceId: string, record: AnalysisRecord): Promise<void>;
  get(spaceId: string, id: string): Promise<AnalysisRecord | undefined>;
  list(spaceId: string, filter?: { platform?: Platform; accountUsername?: string }): Promise<AnalysisRecord[]>;
  delete(spaceId: string, id: string): Promise<boolean>;
  clear(spaceId: string): Promise<number>;
}

/** Valida un registro leído de almacenamiento; descarta datos dañados o manipulados. */
export function parseStoredRecord(value: unknown): AnalysisRecord | undefined {
  const parsed = analysisRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function sortNewestFirst(records: AnalysisRecord[]): AnalysisRecord[] {
  return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

function matches(record: AnalysisRecord, filter?: { platform?: Platform; accountUsername?: string }): boolean {
  if (!filter) return true;
  if (filter.platform && record.platform !== filter.platform) return false;
  if (filter.accountUsername && record.accountUsername.toLowerCase() !== filter.accountUsername.toLowerCase()) return false;
  return true;
}

/** Implementación en memoria: pruebas y modo «no guardar nada». */
export class MemoryAnalysisRepository implements AnalysisRepository {
  private readonly records = new Map<string, AnalysisRecord>();

  async save(spaceId: string, record: AnalysisRecord): Promise<void> {
    if (record.ownerSpaceId !== spaceId) throw new Error("space_mismatch");
    const existing = this.records.get(record.id);
    if (existing && existing.ownerSpaceId !== spaceId) throw new Error("space_mismatch");
    this.records.set(record.id, structuredClone(record));
  }

  async get(spaceId: string, id: string): Promise<AnalysisRecord | undefined> {
    const record = this.records.get(id);
    return record && record.ownerSpaceId === spaceId ? structuredClone(record) : undefined;
  }

  async list(spaceId: string, filter?: { platform?: Platform; accountUsername?: string }): Promise<AnalysisRecord[]> {
    return sortNewestFirst(
      [...this.records.values()].filter((r) => r.ownerSpaceId === spaceId && matches(r, filter)).map((r) => structuredClone(r)),
    );
  }

  async delete(spaceId: string, id: string): Promise<boolean> {
    const record = this.records.get(id);
    if (!record || record.ownerSpaceId !== spaceId) return false;
    return this.records.delete(id);
  }

  async clear(spaceId: string): Promise<number> {
    let removed = 0;
    for (const [id, r] of this.records) {
      if (r.ownerSpaceId === spaceId) {
        this.records.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

export { matches as matchesFilter };
