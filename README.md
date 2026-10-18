# FollowScope

Aplicación web para comparar los **seguidores** y **seguidos** de una cuenta de Instagram o TikTok a partir de la **exportación oficial de datos** que el propio titular descarga desde la plataforma. Todo se procesa en el navegador: los archivos no se suben a ningún servidor y nunca se piden contraseñas.

Calcula tres categorías, con F = seguidores y G = seguidos:

| Categoría | Conjunto | Significado |
| --- | --- | --- |
| Seguimiento mutuo | M = F ∩ G | Sigues a la cuenta y te sigue |
| No te siguen de vuelta | N = G − F | La sigues, pero no aparece entre tus seguidores |
| Te siguen y tú no les sigues | S = F − G | Te sigue, pero tú no la sigues |

> Nombre, lema y textos de marca: `src/config/brand.ts`. Colores: tokens CSS en `src/app/globals.css`.

---

## Estado del proyecto

### Funciona (implementado y cubierto por pruebas)

- Importación de **Instagram** (ZIP completo o `followers_*.json` + `following.json`) y de **TikTok** (ZIP, `user_data*.json` o `Follower.txt` / `Following.txt`).
- Formato **CSV/TXT genérico** (plantilla propia) y reimportación de la exportación **JSON completa** de FollowScope.
- Lectura **segura de ZIP** sin cargarlo entero en memoria: solo se extraen los ficheros necesarios, con límites de tamaño y verificación CRC.
- Validación con mensajes claros: archivo vacío, JSON inválido o truncado, CSV mal formado, campos ausentes, archivo de la otra plataforma, exportación en HTML, ZIP sin las listas, partes de la lista ausentes, exportaciones pedidas para un periodo limitado, duplicados, listas de fechas muy distintas, exportaciones antiguas, límites superados…
- **Motor de comparación** O(n + m) con verificación de invariantes; si alguna falla, el resultado no se muestra como válido.
- Dashboard de resultados: recuentos, gráfico de composición, tres pestañas, búsqueda por usuario o nombre, orden alfabético o por fecha, limpiar filtros, contador de coincidencias, lista virtualizada, copiar usuario y abrir perfil.
- **Exportación CSV y JSON**: todas las categorías, una categoría, la categoría filtrada, el resumen y el historial. CSV con escapado RFC 4180, BOM UTF-8, separador configurable (`,` o `;`) y protección contra inyección de fórmulas.
- **Historial** opcional en IndexedDB (desactivado por defecto), apertura de análisis anteriores y **comparación de dos instantáneas** (altas, bajas y cambios de mutuos).
- Importación en **Web Worker**, con progreso real (archivos procesados) y botón **Cancelar**.
- Diseño responsive (barra lateral en escritorio, navegación inferior en móvil), modo oscuro, accesibilidad (roles ARIA, foco visible, `prefers-reduced-motion`).
- **Datos de demostración** (cuentas ficticias) claramente marcados como tales.
- Cabeceras de seguridad (CSP sin orígenes externos, `X-Frame-Options`, `nosniff`, `Referrer-Policy`).

### Pendiente o no posible hoy

- **Conexión con las API oficiales**: no implementada porque ninguna API oficial de consumo permite obtener las listas de seguidores/seguidos (ver [Limitaciones de las API](#limitaciones-de-las-api-oficiales)). Los adaptadores existen (`src/providers/official-api-providers.ts`) y devuelven explícitamente «no disponible».
- **Multiusuario, cuentas propias y sincronización**: la capa de persistencia está preparada (repositorio por «espacio» de usuario), pero no hay backend.
- Los importadores siguen la estructura **observada** de las exportaciones (ninguna plataforma publica un esquema oficial). El de **Instagram** se ha validado con una exportación real (ZIP JSON de octubre de 2026): estructura reconocida en el 100 % de los registros, sin duplicados ni registros inválidos. El de **TikTok** solo se ha probado con archivos sintéticos: conviene validarlo con una exportación real (ver [Formatos admitidos](#formatos-admitidos)).
- La política de privacidad (`/privacy`) es un **borrador pendiente de revisión legal**.

---

## Requisitos

- Node.js 20 o superior (desarrollado y probado con Node 24.20 y npm 11.19).
- npm.

## Instalación y uso

```bash
npm install
```

Desarrollo (http://localhost:3000):

```bash
npm run dev
```

Compilación de producción y servidor:

```bash
npm run build
```

```bash
npm start
```

Todas las páginas se generan como estáticas; el servidor de Next.js solo sirve los archivos y aplica las cabeceras de seguridad.

## Pruebas

Pruebas unitarias, de integración y de rendimiento (Vitest):

```bash
npm test
```

Pruebas de extremo a extremo (Playwright; compilan y arrancan la app en el puerto 3100 y se ejecutan en Chromium escritorio y móvil). La primera vez instala el navegador:

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

Otras comprobaciones:

```bash
npm run typecheck
```

```bash
npm run lint
```

Solo las pruebas de rendimiento (imprimen tiempos y memoria):

```bash
npm run bench
```

## Versión web publicada (GitHub Pages)

**https://auri-981.github.io/followscope/**

Es una web estática: no hay servidor propio y los archivos que importas siguen procesándose solo en tu navegador.

### Añadirla a la pantalla de inicio

- **iPhone (Safari)**: abre la dirección → botón Compartir → **Añadir a pantalla de inicio**. Usa Safari normal, no la navegación privada.
- **Android (Chrome)**: abre la dirección → menú ⋮ → **Instalar aplicación** o **Añadir a pantalla de inicio**.

Se abre a pantalla completa con su propio icono (manifiesto PWA en `src/app/manifest.ts`, iconos en `public/icons/`, regenerables con `npm run icons`). Necesita conexión para cargarse: no hay modo sin conexión.

### Publicar cambios

```bash
npm run deploy
```

El script (`scripts/deploy-pages.mjs`) genera la web estática en `out/` con el subdirectorio `/followscope` y la sube a la rama `gh-pages`, que es la que sirve GitHub Pages. Tarda uno o dos minutos en verse. Para probar la versión estática en local antes de publicar:

```bash
npm run build:static
```

```bash
npm run preview:static
```

y abre http://localhost:4173/followscope/.

Diferencias con `npm start`: GitHub Pages no permite cabeceras HTTP propias, así que la CSP se incluye como etiqueta `<meta>` (sin `frame-ancestors`, que solo funciona como cabecera) y no se envían `X-Frame-Options` ni `Referrer-Policy`. El paso de compilación también duplica con nombre aplanado los ficheros de precarga de Next 16 (`__next.<ruta>.__PAGE__.txt`), que sin servidor darían error 404.

## Cómo se usa

1. Elige **Instagram** o **TikTok**.
2. Escribe el nombre de usuario de la cuenta (solo identifica el análisis).
3. Arrastra el ZIP de tu exportación (o los archivos sueltos). Las instrucciones para obtenerla están en la propia pantalla.
4. Revisa la vista previa: listas detectadas, número de cuentas, fecha de los datos, avisos y errores.
5. Pulsa **Comparar listas**. El botón solo se activa cuando hay dos listas válidas.
6. Consulta, filtra y exporta los resultados. Opcionalmente, **guárdalos en este dispositivo** para el historial.

Para probar sin datos propios, pulsa **Probar con datos de demostración**. Los archivos de ejemplo están en `public/samples/` (se regeneran con `node scripts/generate-samples.mjs`).

### Cómo obtener la exportación

- **Instagram**: Centro de cuentas → Tu información y permisos → Descargar tu información → «Parte de tu información» → «Seguidores y seguidos» → formato **JSON** (no HTML) → intervalo de fechas **«Desde el principio»**.

  > Con un intervalo limitado (por ejemplo «Último año»), `followers_1.json` solo incluye a quienes te siguieron dentro de ese periodo, mientras que `following.json` puede incluir cuentas más antiguas. Los seguidores antiguos aparecerían entonces como «no te siguen de vuelta». Comprobado con una exportación real: faltaban todos los seguidores anteriores a la fecha de inicio del periodo. FollowScope lo detecta (`src/importers/period.ts`): si sigues a 5 o más cuentas desde más de 60 días antes del seguidor más antiguo del archivo, avisa y marca el análisis como «con limitaciones».
- **TikTok**: Ajustes y privacidad → Cuenta → Descargar tus datos → incluir «Seguidores» y «Siguiendo» → formato **JSON** (o TXT).

Los menús de las plataformas cambian con frecuencia; la app muestra estas instrucciones en cada pantalla de plataforma.

## Formatos admitidos

| Origen | Archivos | Notas |
| --- | --- | --- |
| Instagram | ZIP, `followers_1.json` (`_2`, `_3`…), `following.json` | Usuario en `string_list_data[0].value`, en `title` o deducido de `href` (`/_u/usuario`). Se ignoran otros ficheros (`close_friends.json`…). Se detectan partes ausentes. HTML → error explicativo. |
| TikTok | ZIP, `user_data*.json`, `Follower.txt`, `Following.txt` | El JSON se recorre buscando listas con `UserName` bajo claves como «Follower List › FansList» o «Following List › Following», tolerando reorganizaciones («Your Activity…»). |
| FollowScope | CSV/TSV/TXT con `username` y opcionalmente `display_name`, `profile_url`, `list` (`followers`/`following`), `platform` | Sin columna `list`, el tipo se deduce del nombre del archivo o lo elige el usuario. Plantilla: `public/samples/plantilla-followscope.csv`. |
| FollowScope | Exportación JSON «todas» (`format: "followscope.results"`) | Reimportable. Los CSV de resultados y las exportaciones parciales se rechazan porque podrían estar filtrados. |

Si una plataforma cambia su formato, el importador correspondiente (`src/importers/instagram.ts` o `tiktok.ts`) es el único sitio que hay que tocar.

### Normalización e identidad

- Se recortan espacios, se eliminan caracteres invisibles y el prefijo `@`, y se normaliza Unicode (NFC).
- Instagram y TikTok no distinguen mayúsculas en los nombres de usuario, así que la clave de comparación va en minúsculas. Es una regla explícita por plataforma (`caseSensitive` en `src/domain/platforms.ts`); se conserva el nombre original para mostrarlo.
- La clave de identidad es `plataforma:usuario`: nunca se mezclan cuentas de distintas plataformas.
- **Limitación**: las exportaciones no incluyen un identificador numérico estable. Si una cuenta cambia de nombre entre dos exportaciones, aparece como una cuenta distinta.
- El nombre visible nunca se usa como identificador.

## Arquitectura

```
src/
├─ app/                 Rutas (App Router): inicio, instagram, tiktok, analysis, history, compare, settings, privacy
├─ components/          Interfaz (React). ui/ = componentes base reutilizables
├─ config/              Marca y límites configurables
├─ domain/              Modelos (Zod), reglas por plataforma, normalización, motor de comparación, diferencias entre instantáneas
├─ importers/           ZIP seguro, JSON, CSV, importadores de Instagram/TikTok/genérico y orquestador (pipeline)
├─ providers/           Interfaz SocialDataProvider + adaptadores (archivos, API oficiales)
├─ services/            Orquestación del análisis (proveedor → instantánea → comparación)
├─ persistence/         Repositorio intercambiable (IndexedDB, memoria)
├─ export/              Exportadores CSV/JSON y descarga
├─ workers/             Web Worker de importación y su cliente
└─ state/               Estado de la app (React context) y preferencias
tests/
├─ unit/ integration/ perf/   Vitest
└─ e2e/                       Playwright
```

- El **motor de comparación** (`src/domain/compare.ts`) es TypeScript puro, sin React ni APIs del navegador; se prueba directamente.
- Todas las fuentes de datos implementan `SocialDataProvider` (`getConnectionStatus`, `getAccountProfile`, `getFollowers`, `getFollowing`, `getDataMetadata`, `disconnect`). El servicio `runAnalysis` solo conoce esa interfaz. Una operación no soportada devuelve `{ status: "unsupported", reason }`, nunca datos inventados.
- Modelos de dominio: `SocialAccount`, `AccountSnapshot`, `ComparisonResult`, `AnalysisRecord` (`src/domain/types.ts`), validados con Zod al leerlos del almacenamiento.
- Sin backend ni base de datos en el MVP: no hacen falta. El repositorio (`src/persistence/repository.ts`) está acotado por `spaceId`; una implementación futura con PostgreSQL/Supabase usaría el id del usuario autenticado y políticas RLS. Hay pruebas que verifican que un id ajeno no da acceso a datos de otro espacio.

### Invariantes verificadas en cada comparación

M, N y S disjuntos · |M| + |N| + |S| = |F ∪ G| · |M| + |N| = |G| · |M| + |S| = |F|. Si se incumplen, se registra un error técnico (solo recuentos, sin datos personales) y la interfaz no presenta el resultado como válido.

### Estados de los datos

Sin datos · esperando importación · importando (con progreso y cancelación) · validando · lista para comparar · completado · completado con advertencias («con limitaciones») · datos incompletos · error de formato · cancelado. Los estados de error de conexión, permisos y límite de solicitudes están modelados en `ProviderResult` para las futuras integraciones oficiales.

## Limitaciones de las API oficiales

Revisadas en octubre de 2026:

- **Instagram** — La «Instagram API with Instagram Login» / Graph API (solo cuentas profesionales) ofrece `followers_count` y `follows_count`, pero **no** las listas de seguidores ni de seguidos. La Basic Display API se retiró en diciembre de 2024. Introducir un nombre de usuario público no permite obtener las listas por vías autorizadas.
- **TikTok** — Login Kit + Display API: el ámbito `user.info.stats` da `follower_count` y `following_count`, **sin** listas. La **Research API** sí tiene endpoints de seguidores/seguidos, pero está reservada a investigadores académicos aprobados para un proyecto concreto; no es una vía válida para una app de consumo.

Por eso la vía funcional es la **exportación de datos del titular**, que es oficial, gratuita y no requiere aprobaciones. FollowScope no usa scraping, no evade límites ni CAPTCHAs y no pide contraseñas.

Fuentes: [TikTok — Get User Info (v2)](https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info/), [TikTok — Research API](https://developers.tiktok.com/doc/about-research-api/), [TikTok — Research API: followers](https://developers.tiktok.com/docs/en/research-api-specs-query-user-followers). Guía para futuras integraciones: [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md).

## Privacidad y seguridad

- Procesamiento local; la CSP limita `connect-src` al propio origen, así que la página no puede enviar datos a terceros.
- Por defecto **no se guarda nada**. Guardar es una acción explícita (o una opción en Ajustes) y puede limitarse al resumen, sin listas.
- Los archivos originales nunca se guardan; solo las listas normalizadas, si el usuario guarda un análisis.
- Límites de tamaño, número de registros y profundidad JSON; protección frente a «zip bombs»; enlaces de perfil solo `https` y de dominios oficiales; React escapa todo el contenido (sin `dangerouslySetInnerHTML` salvo el script fijo de tema).
- No hay secretos en el código. `.env.example` solo contiene límites públicos y nombres de variables futuras comentadas.
- No hay acciones automáticas de seguir o dejar de seguir.
- Política de privacidad inicial en `/privacy` (borrador pendiente de revisión legal).

### Límites configurables

En `.env.local` (ver `.env.example`):

| Variable | Por defecto |
| --- | --- |
| `NEXT_PUBLIC_MAX_FILE_MB` | 100 MB por archivo JSON/CSV/TXT |
| `NEXT_PUBLIC_MAX_ZIP_ENTRY_MB` | 200 MB por fichero dentro del ZIP |
| `NEXT_PUBLIC_MAX_RECORDS` | 1.000.000 cuentas por lista |

## Rendimiento (medido)

Medido con `npm run bench` en la máquina de desarrollo (Windows 11, Node 24); los valores varían según el equipo:

- Comparación de 200.000 seguidores × 150.000 seguidos: ~230 ms, ~29 MB de memoria adicional.
- Duplicar el tamaño de entrada multiplicó el tiempo por ~2,4 (comportamiento lineal, sin el coste cuadrático de comparaciones anidadas).
- Importar desde JSON de Instagram y analizar 100.000 + 50.000 cuentas: ~0,4 s en total.

La importación se ejecuta en un Web Worker para no bloquear la interfaz, y las listas se virtualizan.

## Pasos para publicarla

1. Validar los importadores con exportaciones **reales** de Instagram y TikTok y ajustar si el formato difiere.
2. Completar y revisar legalmente la política de privacidad (responsable, contacto) y añadir aviso legal.
3. Valorar un dominio propio y un alojamiento que permita cabeceras de seguridad (en GitHub Pages la CSP solo puede ir como `<meta>`).
4. Revisar la marca definitiva (nombre, logotipo, dominio) y comprobar que no induce a pensar que es una app oficial de Meta o TikTok.
5. Ejecutar `npm run lint`, `npm run typecheck`, `npm test` y `npm run test:e2e` en CI.

## Funciones futuras preparadas

Multiusuario con espacios privados (repositorio por `spaceId`), inicio de sesión propio, OAuth oficial cuando una API lo permita (adaptadores `OfficialApiProvider`), alertas de cambios entre instantáneas (`diffSnapshots`), PWA y monitorización de errores sin datos personales. La internacionalización requerirá extraer los textos, que hoy están en español dentro de los componentes.

## Notas de dependencias

`npm audit` informa de una vulnerabilidad (ReDoS en `braces`) dentro de `eslint-config-next`, una dependencia **solo de desarrollo** que no forma parte del código que se sirve. La solución que propone npm degrada `eslint-config-next` a la versión 14, incompatible con Next 16, por lo que no se ha aplicado.
