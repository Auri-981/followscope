import type { Platform } from "@/domain/types";
import type { ConnectionStatus, DataMetadata, ProviderResult, RelationList, SocialDataProvider } from "./types";
import type { SocialAccount } from "@/domain/types";

/**
 * Adaptadores de las API oficiales, preparados pero NO conectados.
 *
 * Situación de las API oficiales (revisada en octubre de 2026):
 *
 * Instagram — «Instagram API with Instagram Login» / Graph API (solo cuentas
 *   profesionales): el nodo de usuario expone `followers_count` y
 *   `follows_count`, pero no hay ningún endpoint que devuelva las listas de
 *   seguidores ni de seguidos. La Basic Display API se retiró en diciembre de 2024.
 *   → Las listas solo se pueden obtener con la exportación del titular.
 *
 * TikTok — Login Kit + Display API: el ámbito `user.info.stats` da
 *   `follower_count` y `following_count`, sin listas. La Research API sí tiene
 *   endpoints de seguidores/seguidos, pero está reservada a investigadores
 *   académicos aprobados para un proyecto concreto: no sirve para una app de consumo.
 *   → Las listas solo se pueden obtener con la exportación del titular.
 *
 * Cuando exista un backend con OAuth, estos adaptadores podrán implementar
 * `getAccountProfile` (y recuentos para contrastar las importaciones), pero las
 * listas seguirán devolviendo `unsupported` mientras las API no lo permitan.
 * Ver docs/INTEGRACIONES.md.
 */

interface OfficialApiInfo {
  label: string;
  productName: string;
  listReason: string;
}

const INFO: Record<Platform, OfficialApiInfo> = {
  instagram: {
    label: "API oficial de Instagram",
    productName: "Instagram API with Instagram Login (Meta)",
    listReason: "La API oficial de Instagram solo ofrece el número de seguidores y seguidos de cuentas profesionales, no las listas.",
  },
  tiktok: {
    label: "API oficial de TikTok",
    productName: "TikTok Login Kit + Display API",
    listReason:
      "La API de TikTok para aplicaciones solo ofrece el número de seguidores y seguidos, no las listas. La Research API está limitada a investigación académica.",
  },
};

export class OfficialApiProvider implements SocialDataProvider {
  readonly id: string;
  readonly label: string;
  readonly productName: string;
  readonly capabilities = { profile: true, followersList: false, followingList: false, counts: true };
  private readonly info: OfficialApiInfo;

  constructor(readonly platform: Platform) {
    this.info = INFO[platform];
    this.id = `official-api:${platform}`;
    this.label = this.info.label;
    this.productName = this.info.productName;
  }

  /** Motivo por el que no se pueden obtener las listas por esta vía. */
  get listUnavailableReason(): string {
    return this.info.listReason;
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    return {
      state: "not_configured",
      detail: "No disponible en esta versión: requiere un backend con OAuth y la aprobación de la plataforma.",
    };
  }

  async getAccountProfile(): Promise<ProviderResult<SocialAccount>> {
    return { status: "error", code: "not_configured", message: "La conexión oficial todavía no está configurada." };
  }

  async getFollowers(): Promise<ProviderResult<RelationList>> {
    return { status: "unsupported", reason: this.info.listReason };
  }

  async getFollowing(): Promise<ProviderResult<RelationList>> {
    return { status: "unsupported", reason: this.info.listReason };
  }

  async getDataMetadata(): Promise<ProviderResult<DataMetadata>> {
    return { status: "error", code: "not_configured", message: "La conexión oficial todavía no está configurada." };
  }

  async disconnect(): Promise<void> {}
}

export const officialProviders: Record<Platform, OfficialApiProvider> = {
  instagram: new OfficialApiProvider("instagram"),
  tiktok: new OfficialApiProvider("tiktok"),
};
