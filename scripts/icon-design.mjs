// Diseño del icono de FollowScope, en un solo sitio.
//
// Concepto: dos círculos que se cruzan (tus seguidores y tus seguidos) con la
// zona común resaltada (seguimiento mutuo). El círculo derecho tiene mango,
// así que también es una lupa: «scope», analizar tu red.
//
// Todas las variantes (app, pantalla de inicio, WhatsApp, favicon) salen de
// esta función para que el icono sea siempre idéntico.

export const BRAND = {
  from: "#4f46e5", // índigo (color primario de la app)
  to: "#7c3aed", // violeta
  mutual: "#c7d2fe", // zona común
};

/**
 * @param {object} opts
 * @param {number} opts.size        Lado del lienzo en píxeles.
 * @param {number} [opts.scale]     Tamaño del dibujo respecto al lienzo (1 = normal; <1 deja margen, p. ej. iconos «maskable»).
 * @param {number} [opts.radius]    Radio de las esquinas del fondo como fracción del lado (0 = cuadrado completo).
 * @param {boolean} [opts.bold]     Trazos más gruesos para tamaños muy pequeños (favicon).
 */
export function iconSvg({ size, scale = 1, radius = 0, bold = false }) {
  const k = scale;
  // Geometría en un lienzo de 1024, centrada en (512, 512) y escalada alrededor del centro.
  const p = (v) => 512 + (v - 512) * k;
  const ring = 190 * k;
  const stroke = (bold ? 78 : 58) * k;
  const handle = (bold ? 86 : 66) * k;
  const ax = p(395), bx = p(579), cy = p(482);
  const h1 = { x: p(731), y: p(634) };
  const h2 = { x: p(820), y: p(723) };
  const r = radius * 1024;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.from}"/>
      <stop offset="1" stop-color="${BRAND.to}"/>
    </linearGradient>
    <radialGradient id="shine" cx="0.22" cy="0.12" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="ringA"><circle cx="${ax}" cy="${cy}" r="${ring}"/></clipPath>
  </defs>
  <rect width="1024" height="1024" rx="${r}" fill="url(#bg)"/>
  <rect width="1024" height="1024" rx="${r}" fill="url(#shine)"/>
  <circle cx="${bx}" cy="${cy}" r="${ring}" fill="${BRAND.mutual}" clip-path="url(#ringA)"/>
  <line x1="${h1.x}" y1="${h1.y}" x2="${h2.x}" y2="${h2.y}" stroke="#ffffff" stroke-width="${handle}" stroke-linecap="round"/>
  <circle cx="${ax}" cy="${cy}" r="${ring}" fill="none" stroke="#ffffff" stroke-width="${stroke}"/>
  <circle cx="${bx}" cy="${cy}" r="${ring}" fill="none" stroke="#ffffff" stroke-width="${stroke}"/>
</svg>`;
}
