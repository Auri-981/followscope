// Genera los iconos PNG de la app (PWA, pantalla de inicio) a partir del logotipo SVG.
// Uso: node scripts/generate-icons.mjs  (requiere: npx playwright install chromium)
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const OUT = new URL("../public/icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const PRIMARY = "#4f46e5";

/** scale: tamaño de los círculos respecto al lienzo (los iconos «maskable» necesitan margen). */
function svg(size, { rounded, scale }) {
  const r = (6.5 / 32) * size * scale;
  const stroke = (2.2 / 32) * size * scale;
  const cy = size / 2;
  const dx = (3.5 / 32) * size * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${rounded ? size * 0.28 : 0}" fill="${PRIMARY}"/>
    <circle cx="${cy - dx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${stroke}"/>
    <circle cx="${cy + dx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="${stroke}"/>
  </svg>`;
}

const ICONS = [
  { file: "icon-192.png", size: 192, rounded: false, scale: 1 },
  { file: "icon-512.png", size: 512, rounded: false, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, rounded: false, scale: 0.72 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, scale: 0.9 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(`<html><body style="margin:0">${svg(icon.size, icon)}</body></html>`);
  await page.locator("svg").screenshot({ path: fileURLToPath(new URL(icon.file, OUT)) });
  console.log("✓", icon.file);
}
await browser.close();
