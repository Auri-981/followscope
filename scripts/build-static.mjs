// Genera la web estática en `out/` para alojamientos sin servidor (GitHub Pages).
// Uso: npm run build:static   (BASE_PATH opcional, por defecto /followscope)
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const basePath = process.env.BASE_PATH ?? "/followscope";

console.log(`\n▶ Generando la web estática (base: ${basePath})…`);
execFileSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, STATIC_EXPORT: "true", BASE_PATH: basePath },
});
if (!existsSync(path.join(out, "index.html"))) throw new Error("No se ha generado out/index.html");

/**
 * Next 16 exporta los datos de precarga de cada segmento en subcarpetas
 * (`instagram/__next.instagram/__PAGE__.txt`), pero el cliente los pide con el
 * nombre aplanado (`instagram/__next.instagram.__PAGE__.txt`). Sin un servidor
 * que reescriba rutas, esas peticiones darían 404: se crea también la copia aplanada.
 */
let flattened = 0;
function flatten(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      const walk = (sub, prefix) => {
        for (const child of readdirSync(sub)) {
          const childPath = path.join(sub, child);
          if (statSync(childPath).isDirectory()) walk(childPath, `${prefix}.${child}`);
          else {
            copyFileSync(childPath, path.join(dir, `${prefix}.${child}`));
            flattened++;
          }
        }
      };
      walk(full, name);
    } else flatten(full);
  }
}
flatten(out);

// GitHub Pages ejecuta Jekyll por defecto, que ignora las carpetas que empiezan por "_" (como _next).
writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`✓ Web estática lista en out/ (${flattened} ficheros de precarga aplanados).`);
