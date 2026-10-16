// Genera los archivos de ejemplo de public/samples con cuentas FICTICIAS.
// Uso: node scripts/generate-samples.mjs
// Las estructuras imitan las exportaciones observadas de Instagram y TikTok;
// no son especificaciones oficiales (ninguna de las dos plataformas publica una).
import { mkdirSync, writeFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";

const OUT = new URL("../public/samples/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const first = ["luna", "pablo", "sofia", "mateo", "vera", "hugo", "alba", "leo", "nora", "dario", "iris", "gael", "maia", "bruno", "clara", "teo", "olivia", "marco", "lucia", "enzo"];
const second = ["viaja", "foto", "cocina", "dev", "musica", "runner", "lee", "pinta", "surf", "jardin"];

// Generador determinista para que los ejemplos no cambien entre ejecuciones.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const pool = [];
for (const a of first) for (const b of second) pool.push(`${a}.${b}`);
const pick = (n) => {
  const copy = [...pool];
  const out = [];
  while (out.length < n) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};

const people = pick(90);
const followers = people.slice(0, 64); // 64 seguidores
const following = [...people.slice(20, 64), ...people.slice(64, 82)]; // 44 mutuos + 18 que no te siguen
const ts = (i) => 1_700_000_000 + i * 86_400;

// --- Instagram ---
const igFollowers = followers.map((u, i) => ({
  title: "",
  media_list_data: [],
  string_list_data: [{ href: `https://www.instagram.com/${u}`, value: u, timestamp: ts(i) }],
}));
// Formato reciente: el usuario va en "title" y el enlace usa /_u/.
const igFollowing = {
  relationships_following: following.map((u, i) => ({
    title: u,
    string_list_data: [{ href: `https://www.instagram.com/_u/${u}`, timestamp: ts(i + 10) }],
  })),
};
writeFileSync(new URL("instagram/followers_1.json", OUT), JSON.stringify(igFollowers, null, 2), { flag: "w" });
writeFileSync(new URL("instagram/following.json", OUT), JSON.stringify(igFollowing, null, 2));
writeFileSync(
  new URL("instagram-export-ejemplo.zip", OUT),
  zipSync({
    "connections/followers_and_following/followers_1.json": strToU8(JSON.stringify(igFollowers)),
    "connections/followers_and_following/following.json": strToU8(JSON.stringify(igFollowing)),
    "connections/followers_and_following/close_friends.json": strToU8(JSON.stringify({ relationships_close_friends: [] })),
  }),
);

// --- TikTok ---
const date = (i) => new Date((ts(i)) * 1000).toISOString().replace("T", " ").slice(0, 19);
const tiktok = {
  Activity: {
    "Follower List": { FansList: followers.map((u, i) => ({ Date: date(i), UserName: u.replace(".", "_") })) },
    "Following List": { Following: following.map((u, i) => ({ Date: date(i + 5), UserName: u.replace(".", "_") })) },
    "Like List": { ItemFavoriteList: [] },
  },
  Profile: { "Profile Information": { ProfileMap: { userName: "demo_followscope" } } },
};
writeFileSync(new URL("tiktok/user_data_tiktok.json", OUT), JSON.stringify(tiktok, null, 2));

// --- Plantilla CSV genérica ---
const csv = ["username,display_name,list"];
followers.slice(0, 5).forEach((u) => csv.push(`${u},,followers`));
following.slice(-3).forEach((u) => csv.push(`${u},,following`));
writeFileSync(new URL("plantilla-followscope.csv", OUT), csv.join("\n") + "\n");

console.log(`Seguidores: ${followers.length}, seguidos: ${following.length}`);
