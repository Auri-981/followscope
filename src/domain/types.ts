import { z } from "zod";

/**
 * Modelos de dominio de FollowScope. Son independientes de React y de la
 * fuente de datos: tanto los importadores de archivos como las futuras
 * integraciones oficiales producen estos mismos tipos.
 */

export const platformSchema = z.enum(["instagram", "tiktok"]);
export type Platform = z.infer<typeof platformSchema>;
export const PLATFORMS: readonly Platform[] = ["instagram", "tiktok"] as const;

/** Origen de los datos de una instantánea. */
export const dataSourceSchema = z.enum(["file_import", "official_api", "demo"]);
export type DataSource = z.infer<typeof dataSourceSchema>;

/**
 * complete: ambas listas presentes y sin indicios de truncado.
 * partial: falta información o hay indicios de que la lista está incompleta.
 */
export const completenessSchema = z.enum(["complete", "partial"]);
export type CompletenessStatus = z.infer<typeof completenessSchema>;

export const warningSchema = z.object({
  code: z.string(),
  message: z.string(),
  /** "blocking" impide presentar el resultado como completo. */
  severity: z.enum(["info", "warning", "blocking"]),
});
export type DataWarning = z.infer<typeof warningSchema>;

/**
 * Cuenta de una red social. `id` es la clave de identidad estable dentro de la
 * plataforma (`<plataforma>:<clave>`). Nunca se cruzan cuentas entre plataformas.
 */
export const socialAccountSchema = z.object({
  id: z.string().min(1),
  platform: platformSchema,
  username: z.string().min(1),
  displayName: z.string().optional(),
  avatarUrl: z.url().optional(),
  profileUrl: z.url().optional(),
});
export type SocialAccount = z.infer<typeof socialAccountSchema>;

/** Una cuenta dentro de una lista de seguidores o seguidos. */
export const relationEntrySchema = socialAccountSchema.extend({
  /** Fecha (ISO) desde la que existe la relación, si la exportación la incluye. */
  since: z.string().optional(),
});
export type RelationEntry = z.infer<typeof relationEntrySchema>;

export const accountSnapshotSchema = z.object({
  id: z.string().min(1),
  /** Cuenta analizada (propietaria de las listas). */
  accountId: z.string().min(1),
  ownerUsername: z.string().min(1),
  platform: platformSchema,
  /** Momento al que corresponden los datos (fecha de exportación si se conoce). */
  capturedAt: z.string(),
  source: dataSourceSchema,
  followers: z.array(relationEntrySchema),
  following: z.array(relationEntrySchema),
  /** Fechas de captura de cada lista por separado, si se conocen. */
  listDates: z.object({ followers: z.string().optional(), following: z.string().optional() }),
  completenessStatus: completenessSchema,
  validationWarnings: z.array(warningSchema),
});
export type AccountSnapshot = z.infer<typeof accountSnapshotSchema>;

/** Cuenta dentro de un resultado, con las fechas de ambas relaciones si existen. */
export interface ComparedAccount extends SocialAccount {
  followerSince?: string;
  followingSince?: string;
}

export type CategoryKey = "mutualFollows" | "notFollowingBack" | "followsYouOnly";
export const CATEGORY_KEYS: readonly CategoryKey[] = ["mutualFollows", "notFollowingBack", "followsYouOnly"];

export interface ComparisonResult {
  snapshotId: string;
  comparedAt: string;
  mutualFollows: ComparedAccount[];
  notFollowingBack: ComparedAccount[];
  followsYouOnly: ComparedAccount[];
  followerCount: number;
  followingCount: number;
  mutualCount: number;
  notFollowingBackCount: number;
  followsYouOnlyCount: number;
  /** true solo si los datos son completos y se cumplen todas las invariantes. */
  isComplete: boolean;
  /** false si alguna invariante matemática falla: el resultado no es válido. */
  invariantsHold: boolean;
  warnings: DataWarning[];
}

export interface ComparisonCounts {
  followerCount: number;
  followingCount: number;
  mutualCount: number;
  notFollowingBackCount: number;
  followsYouOnlyCount: number;
}

/** Registro del historial de análisis. */
export const analysisRecordSchema = z.object({
  id: z.string().min(1),
  /** Espacio de datos propietario. En el MVP siempre "local"; en multiusuario, el id del usuario. */
  ownerSpaceId: z.string().min(1),
  platform: platformSchema,
  accountUsername: z.string().min(1),
  createdAt: z.string(),
  source: dataSourceSchema,
  completenessStatus: completenessSchema,
  isComplete: z.boolean(),
  counts: z.object({
    followerCount: z.number().int().nonnegative(),
    followingCount: z.number().int().nonnegative(),
    mutualCount: z.number().int().nonnegative(),
    notFollowingBackCount: z.number().int().nonnegative(),
    followsYouOnlyCount: z.number().int().nonnegative(),
  }),
  warnings: z.array(warningSchema),
  /** Instantánea completa. Ausente si el usuario eligió guardar solo el resumen. */
  snapshot: accountSnapshotSchema.optional(),
});
export type AnalysisRecord = z.infer<typeof analysisRecordSchema>;
