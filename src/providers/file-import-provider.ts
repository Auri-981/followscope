import { accountId, normalizeUsername, platformRules } from "@/domain/platforms";
import type { Platform, SocialAccount } from "@/domain/types";
import type { ImportOutcome, ListSummary } from "@/importers/types";
import type {
  ConnectionStatus,
  DataMetadata,
  ListMetadata,
  ProviderResult,
  RelationList,
  SocialDataProvider,
} from "./types";

/**
 * Proveedor basado en los archivos que el propio titular exporta desde la
 * plataforma. Es la vía funcional del MVP: no necesita credenciales.
 */
export class FileImportProvider implements SocialDataProvider {
  readonly id: string;
  readonly platform: Platform;
  readonly label = "Importación de archivos";
  readonly capabilities = { profile: true, followersList: true, followingList: true, counts: true };
  private outcome: ImportOutcome | undefined;

  constructor(
    outcome: ImportOutcome,
    private readonly ownerUsername: string,
    private readonly importedAt: string = new Date().toISOString(),
  ) {
    this.outcome = outcome;
    this.platform = outcome.platform;
    this.id = `file-import:${outcome.platform}`;
  }

  private metadataFor(list: ListSummary | undefined): ListMetadata | undefined {
    if (!list || !this.outcome) return undefined;
    return {
      source: this.outcome.isDemo ? "demo" : "file_import",
      capturedAt: list.fileDate,
      complete: !this.outcome.incomplete,
      origin: list.sourceFiles,
      // Incluye también los avisos globales de la importación (p. ej. periodo limitado).
      warnings: [...this.outcome.warnings, ...list.warnings],
    };
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    if (!this.outcome) return { state: "disconnected", detail: "Los datos importados se han descartado." };
    return { state: "connected", detail: "Datos importados desde archivos.", lastSyncAt: this.importedAt };
  }

  async getAccountProfile(): Promise<ProviderResult<SocialAccount>> {
    const check = normalizeUsername(this.platform, this.ownerUsername);
    if (!check.ok) return { status: "error", code: "invalid_response", message: "El nombre de la cuenta no es válido." };
    return {
      status: "ok",
      data: {
        id: accountId(this.platform, check.key),
        platform: this.platform,
        username: check.display,
        profileUrl: platformRules[this.platform].buildProfileUrl(check.key),
      },
    };
  }

  private list(kind: "followers" | "following"): ProviderResult<RelationList> {
    if (!this.outcome) return { status: "error", code: "not_connected", message: "No hay datos importados." };
    const list = this.outcome[kind];
    const metadata = this.metadataFor(list);
    if (!list || !metadata) {
      return {
        status: "error",
        code: "incomplete_response",
        message: kind === "followers" ? "No se ha importado la lista de seguidores." : "No se ha importado la lista de seguidos.",
      };
    }
    return { status: "ok", data: { entries: list.entries, metadata } };
  }

  async getFollowers(): Promise<ProviderResult<RelationList>> {
    return this.list("followers");
  }

  async getFollowing(): Promise<ProviderResult<RelationList>> {
    return this.list("following");
  }

  async getDataMetadata(): Promise<ProviderResult<DataMetadata>> {
    if (!this.outcome) return { status: "error", code: "not_connected", message: "No hay datos importados." };
    return {
      status: "ok",
      data: {
        source: this.outcome.isDemo ? "demo" : "file_import",
        followers: this.metadataFor(this.outcome.followers),
        following: this.metadataFor(this.outcome.following),
      },
    };
  }

  async disconnect(): Promise<void> {
    this.outcome = undefined;
  }
}
