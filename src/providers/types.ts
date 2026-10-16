import type { DataSource, DataWarning, Platform, RelationEntry, SocialAccount } from "@/domain/types";

/**
 * Contrato común de todas las fuentes de datos (importación de archivos, API
 * oficiales futuras…). La lógica de negocio solo conoce esta interfaz.
 *
 * Regla: si una operación no está soportada, se devuelve `unsupported` con el
 * motivo. Nunca se devuelven datos inventados ni listas vacías "de relleno".
 */

export type ProviderErrorCode =
  | "not_connected"
  | "not_configured"
  | "permission_denied"
  | "credentials_expired"
  | "rate_limited"
  | "network_error"
  | "invalid_response"
  | "incomplete_response";

export type ProviderResult<T> =
  | { status: "ok"; data: T }
  | { status: "unsupported"; reason: string }
  | { status: "error"; code: ProviderErrorCode; message: string; retryAfterMs?: number };

export type ConnectionState = "connected" | "disconnected" | "not_configured" | "unavailable";

export interface ConnectionStatus {
  state: ConnectionState;
  /** Explicación breve para la interfaz. */
  detail: string;
  lastSyncAt?: string;
}

export interface ListMetadata {
  source: DataSource;
  /** Fecha a la que corresponden los datos, si se conoce. */
  capturedAt?: string;
  /** El proveedor confirma que la lista está completa (no truncada ni paginada a medias). */
  complete: boolean;
  /** Ficheros o endpoints de los que procede la lista (sin datos sensibles). */
  origin: string[];
  /** Avisos de validación detectados al obtener la lista. */
  warnings: DataWarning[];
}

export interface RelationList {
  entries: RelationEntry[];
  metadata: ListMetadata;
}

export interface DataMetadata {
  source: DataSource;
  followers?: ListMetadata;
  following?: ListMetadata;
}

export interface ProviderCapabilities {
  profile: boolean;
  followersList: boolean;
  followingList: boolean;
  counts: boolean;
}

export interface SocialDataProvider {
  readonly id: string;
  readonly platform: Platform;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  getConnectionStatus(): Promise<ConnectionStatus>;
  getAccountProfile(): Promise<ProviderResult<SocialAccount>>;
  getFollowers(signal?: AbortSignal): Promise<ProviderResult<RelationList>>;
  getFollowing(signal?: AbortSignal): Promise<ProviderResult<RelationList>>;
  getDataMetadata(): Promise<ProviderResult<DataMetadata>>;
  disconnect(): Promise<void>;
}
