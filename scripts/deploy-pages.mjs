// Publica FollowScope en GitHub Pages.
//
// 1. Genera la web estática en `out/` (scripts/build-static.mjs) con el subdirectorio /followscope.
// 2. Sube el contenido de `out/` a la rama `gh-pages` del remoto `origin`
//    (se reescribe en cada publicación; el historial del código no se toca).
//
// Uso: npm run deploy
// Variables opcionales: BASE_PATH (por defecto /followscope), PAGES_REMOTE (por defecto origin).
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const basePath = process.env.BASE_PATH ?? "/followscope";
const remoteName = process.env.PAGES_REMOTE ?? "origin";

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const remoteUrl = git(["remote", "get-url", remoteName], root);
const sourceCommit = git(["rev-parse", "--short", "HEAD"], root);

run(process.execPath, [path.join(root, "scripts", "build-static.mjs")], { cwd: root, env: { ...process.env, BASE_PATH: basePath } });
if (!existsSync(path.join(out, ".nojekyll"))) throw new Error("La compilación estática no ha terminado correctamente");

console.log(`\n▶ Publicando en la rama gh-pages de ${remoteName}…`);
rmSync(path.join(out, ".git"), { recursive: true, force: true });
git(["init", "-q", "-b", "gh-pages"], out);
git(["add", "-A"], out);
git(["commit", "-q", "-m", `Publicación desde ${sourceCommit}`], out);
run("git", ["push", "-f", remoteUrl, "gh-pages"], { cwd: out });
rmSync(path.join(out, ".git"), { recursive: true, force: true });

console.log("\n✓ Publicado. GitHub Pages tarda uno o dos minutos en actualizarse.");
