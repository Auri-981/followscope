import type { AnalysisRecord, Platform } from "@/domain/types";
import { matchesFilter, parseStoredRecord, sortNewestFirst, type AnalysisRepository } from "./repository";

/**
 * Historial guardado en IndexedDB, solo en este navegador. Nada sale del
 * dispositivo. Los registros se validan con Zod al leerlos.
 */
const DB_NAME = "followscope";
const DB_VERSION = 1;
const STORE = "analyses";

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDbAnalysisRepository implements AnalysisRepository {
  private dbPromise: Promise<IDBDatabase> | undefined;

  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}

  private db(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new Error("indexeddb_unavailable"));
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = this.factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("ownerSpaceId", "ownerSpaceId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.db();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async save(spaceId: string, record: AnalysisRecord): Promise<void> {
    if (record.ownerSpaceId !== spaceId) throw new Error("space_mismatch");
    const existing = parseStoredRecord(await promisify((await this.store("readonly")).get(record.id)));
    if (existing && existing.ownerSpaceId !== spaceId) throw new Error("space_mismatch");
    await promisify((await this.store("readwrite")).put(record));
  }

  async get(spaceId: string, id: string): Promise<AnalysisRecord | undefined> {
    const record = parseStoredRecord(await promisify((await this.store("readonly")).get(id)));
    return record && record.ownerSpaceId === spaceId ? record : undefined;
  }

  async list(spaceId: string, filter?: { platform?: Platform; accountUsername?: string }): Promise<AnalysisRecord[]> {
    const store = await this.store("readonly");
    const raw = await promisify(store.index("ownerSpaceId").getAll(spaceId));
    const records = raw.map(parseStoredRecord).filter((r): r is AnalysisRecord => Boolean(r) && r!.ownerSpaceId === spaceId);
    return sortNewestFirst(records.filter((r) => matchesFilter(r, filter)));
  }

  async delete(spaceId: string, id: string): Promise<boolean> {
    const existing = await this.get(spaceId, id);
    if (!existing) return false;
    await promisify((await this.store("readwrite")).delete(id));
    return true;
  }

  async clear(spaceId: string): Promise<number> {
    const records = await this.list(spaceId);
    const store = await this.store("readwrite");
    await Promise.all(records.map((r) => promisify(store.delete(r.id))));
    return records.length;
  }
}
