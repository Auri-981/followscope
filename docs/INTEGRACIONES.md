# Guía para incorporar fuentes de datos

FollowScope separa la obtención de datos de la lógica de negocio mediante la interfaz `SocialDataProvider` (`src/providers/types.ts`). El servicio `runAnalysis` (`src/services/analysis.ts`) recibe cualquier proveedor, construye la instantánea y ejecuta el motor de comparación, sin saber de dónde vienen los datos.

## Contrato

| Método | Debe devolver |
| --- | --- |
| `getConnectionStatus()` | `connected` / `disconnected` / `not_configured` / `unavailable` + explicación |
| `getAccountProfile()` | La cuenta analizada (`SocialAccount`) |
| `getFollowers()` / `getFollowing()` | `RelationList` con `entries` normalizadas y `metadata` (`source`, `capturedAt`, `complete`, `origin`, `warnings`) |
| `getDataMetadata()` | Metadatos de ambas listas |
| `disconnect()` | Descarta credenciales y datos en memoria |

Reglas:

- Si una operación no existe en la plataforma, devuelve `{ status: "unsupported", reason }`. Nunca una lista vacía «de relleno».
- Errores: `{ status: "error", code, message, retryAfterMs? }` con los códigos `not_connected`, `not_configured`, `permission_denied`, `credentials_expired`, `rate_limited`, `network_error`, `invalid_response`, `incomplete_response`.
- Marca `metadata.complete = false` si la paginación se interrumpió o la respuesta es parcial: el resultado se mostrará «con limitaciones».
- Normaliza las cuentas con `normalizeAccountList` (`src/domain/normalize.ts`) para respetar las reglas de identidad de cada plataforma.

## Añadir un formato de archivo

1. Crea el lector en `src/importers/` devolviendo `DetectedList[]` (registros en bruto + tipo de lista).
2. Regístralo en `parseTextEntry` (`src/importers/pipeline.ts`) y, si viene en ZIP, en `isRelevantZipPath`.
3. Añade pruebas en `tests/unit/importers.test.ts` con datos sintéticos.

## Integración oficial (cuando sea viable)

Hoy no lo es para las listas (ver README, «Limitaciones de las API oficiales»). Si una plataforma llegara a ofrecerlo:

1. **Backend obligatorio.** Los secretos de la app (`INSTAGRAM_APP_SECRET`, `TIKTOK_CLIENT_SECRET`) solo pueden vivir en el servidor; nunca con prefijo `NEXT_PUBLIC_`. Implementa el flujo OAuth (Authorization Code + PKCE) en rutas de servidor (`src/app/api/...`).
2. **Tokens**: guárdalos cifrados en el servidor, asociados al usuario de FollowScope, con caducidad y renovación. El navegador solo recibe una cookie de sesión `HttpOnly`, `Secure`, `SameSite=Lax`; protege los endpoints que cambian estado frente a CSRF.
3. **Adaptador**: amplía `OfficialApiProvider` (`src/providers/official-api-providers.ts`) para que llame a tu backend. Gestiona paginación con cursores, reintentos con espera exponencial, `rate_limited` con `retryAfterMs` y validación Zod de cada respuesta.
4. **Persistencia multiusuario**: implementa `AnalysisRepository` sobre PostgreSQL/Supabase usando el id del usuario autenticado como `spaceId`, con políticas RLS, validación del lado del servidor y migraciones versionadas. Las pruebas de `tests/unit/persistence.test.ts` describen el comportamiento de aislamiento esperado.
5. **Aprobaciones**: Meta exige revisión de la app para permisos avanzados y TikTok exige aprobar Login Kit y cada ámbito (`user.info.stats`…). Documenta los ámbitos solicitados y su justificación.
6. **Privacidad**: actualiza `/privacy` antes de activar la integración (nuevos datos, servidores, plazos de conservación) y pide consentimiento cuando corresponda.

Mientras tanto, un uso legítimo de la API oficial sería contrastar los recuentos (`followers_count`) con las listas importadas para detectar exportaciones incompletas.
