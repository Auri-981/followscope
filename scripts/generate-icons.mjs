// Genera todas las variantes del icono de FollowScope a partir de scripts/icon-design.mjs.
//
// Uso:  npm run icons                      → genera los archivos
//       npm run icons -- --preview <png>   → además, una hoja de vista previa
// Requiere: npx playwright install chromium
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { iconSvg } from "./icon-design.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const at = (...p) => path.join(root, ...p);

/** Variantes en PNG: ruta → opciones del dibujo. */
const PNGS = [
  // Pantalla de inicio / PWA. Cuadrado completo: iOS y Android aplican su propia máscara.
  { file: at("public", "icons", "icon-192.png"), size: 192 },
  { file: at("public", "icons", "icon-512.png"), size: 512 },
  { file: at("public", "icons", "apple-touch-icon.png"), size: 180 },
  // Android «maskable»: el dibujo cabe en la zona segura central (80 %).
  { file: at("public", "icons", "icon-maskable-512.png"), size: 512, scale: 0.8 },
  // Foto de perfil de WhatsApp (se recorta en círculo) y versión grande para otros usos.
  { file: at("branding", "followscope-whatsapp.png"), size: 1024, scale: 0.9 },
  { file: at("branding", "followscope-icon-1024.png"), size: 1024 },
];

mkdirSync(at("public", "icons"), { recursive: true });
mkdirSync(at("branding"), { recursive: true });

// SVG: original editable y favicon (esquinas redondeadas, trazo más grueso para verse a 16-32 px).
writeFileSync(at("branding", "followscope-icon.svg"), iconSvg({ size: 1024 }) + "\n");
writeFileSync(at("src", "app", "icon.svg"), iconSvg({ size: 32, radius: 0.22, bold: true }) + "\n");

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator("svg").screenshot({ path: file, omitBackground: true });
}
for (const { file, size, ...opts } of PNGS) {
  await render(iconSvg({ size, ...opts }), size, file);
  console.log("✓", path.relative(root, file));
}
console.log("✓ branding/followscope-icon.svg\n✓ src/app/icon.svg");

const previewIndex = process.argv.indexOf("--preview");
if (previewIndex > 0) {
  const out = process.argv[previewIndex + 1];
  const tile = (label, inner, bg = "#f1f3f9") =>
    `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px;background:${bg};border-radius:18px">${inner}<figcaption style="font:13px system-ui;color:${bg === "#0b0e17" ? "#9aa3b8" : "#5b6478"}">${label}</figcaption></figure>`;
  const html = `<html><body style="margin:0;padding:24px;background:#fff;font-family:system-ui">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;width:1100px">
      ${tile("Original", iconSvg({ size: 260 }))}
      ${tile("iPhone (esquinas iOS)", `<div style="width:180px;height:180px;border-radius:40px;overflow:hidden">${iconSvg({ size: 180 })}</div>`)}
      ${tile("WhatsApp (círculo)", `<div style="width:200px;height:200px;border-radius:50%;overflow:hidden">${iconSvg({ size: 200, scale: 0.9 })}</div>`)}
      ${tile("Android (círculo)", `<div style="width:150px;height:150px;border-radius:50%;overflow:hidden">${iconSvg({ size: 150, scale: 0.8 })}</div>`)}
      ${tile("Modo oscuro · 60 px", `<div style="width:60px;height:60px;border-radius:14px;overflow:hidden">${iconSvg({ size: 60 })}</div>`, "#0b0e17")}
      ${tile("Favicon · 32 / 16 px", `<div style="display:flex;gap:10px;align-items:center">${iconSvg({ size: 32, radius: 0.22, bold: true })}${iconSvg({ size: 16, radius: 0.22, bold: true })}</div>`)}
    </div></body></html>`;
  await page.setViewportSize({ width: 1150, height: 600 });
  await page.setContent(html);
  await page.locator("div").first().screenshot({ path: out });
  console.log("✓ vista previa:", out);
}
await browser.close();
