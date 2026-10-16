/**
 * Política de seguridad de contenido (CSP). La aplicación no necesita
 * contactar con ningún servidor externo: los archivos se procesan en el
 * navegador, así que `connect-src` se limita al propio origen.
 *
 * - En el servidor de Next.js se envía como cabecera (ver next.config.ts).
 * - En la exportación estática (GitHub Pages no permite cabeceras propias) se
 *   inserta como <meta>. Ahí `frame-ancestors` no tiene efecto y se omite.
 */
export function contentSecurityPolicy({ dev, meta }: { dev: boolean; meta: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(meta ? [] : ["frame-ancestors 'none'"]),
  ].join("; ");
}
