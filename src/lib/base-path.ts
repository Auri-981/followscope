/**
 * Prefijo de ruta cuando la app se sirve en un subdirectorio (GitHub Pages:
 * /followscope). `next/link` y el router lo añaden solos; esta función es
 * para URL escritas a mano (fetch, enlaces de descarga, manifiesto…).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
