import type { Platform } from "./types";

/**
 * Reglas de identidad por plataforma.
 *
 * Instagram y TikTok tratan los nombres de usuario sin distinguir mayúsculas
 * (no pueden coexistir "Ana" y "ana"), así que la clave de comparación se pasa
 * a minúsculas. Se modela como regla explícita (`caseSensitive`) para que una
 * futura plataforma sensible a mayúsculas no herede ese comportamiento.
 *
 * Limitación documentada: las exportaciones solo incluyen el nombre de usuario,
 * no un identificador numérico estable. Si una cuenta cambia de nombre entre
 * dos exportaciones, aparecerá como una cuenta distinta.
 */
export interface PlatformRules {
  platform: Platform;
  label: string;
  caseSensitive: boolean;
  /** Formato habitual de un nombre de usuario válido (tras normalizar). */
  usernamePattern: RegExp;
  maxUsernameLength: number;
  /** Hosts considerados fiables para enlaces de perfil. */
  profileHosts: readonly string[];
  buildProfileUrl(username: string): string;
}

export const platformRules: Record<Platform, PlatformRules> = {
  instagram: {
    platform: "instagram",
    label: "Instagram",
    caseSensitive: false,
    usernamePattern: /^[a-z0-9._]{1,30}$/,
    maxUsernameLength: 30,
    profileHosts: ["instagram.com", "www.instagram.com"],
    buildProfileUrl: (username) => `https://www.instagram.com/${encodeURIComponent(username)}/`,
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    caseSensitive: false,
    usernamePattern: /^[a-z0-9._]{1,24}$/,
    maxUsernameLength: 24,
    profileHosts: ["tiktok.com", "www.tiktok.com"],
    buildProfileUrl: (username) => `https://www.tiktok.com/@${encodeURIComponent(username)}`,
  },
};

export function platformLabel(platform: Platform): string {
  return platformRules[platform].label;
}

// Caracteres invisibles que a veces se cuelan al copiar y pegar.
const INVISIBLE = /[​-‍⁠﻿]/g;
// Espacios o caracteres de control dentro del nombre: no es un usuario válido.
const FORBIDDEN_INSIDE = /[\s\p{Cc}]/u;

export type UsernameCheck =
  | { ok: true; display: string; key: string; unusual: boolean }
  | { ok: false; reason: "empty" | "invalid_characters" | "too_long" };

/**
 * Limpia un nombre de usuario: recorta espacios, quita caracteres invisibles y
 * el prefijo "@". Devuelve la forma para mostrar (mayúsculas originales) y la
 * clave de comparación según las reglas de la plataforma.
 */
export function normalizeUsername(platform: Platform, raw: unknown): UsernameCheck {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };
  const rules = platformRules[platform];
  let value = raw.normalize("NFC").replace(INVISIBLE, "").trim();
  value = value.replace(/^@+/, "").trim();
  if (!value) return { ok: false, reason: "empty" };
  if (FORBIDDEN_INSIDE.test(value)) return { ok: false, reason: "invalid_characters" };
  // Margen amplio sobre el máximo oficial: preferimos avisar a descartar datos reales.
  if (value.length > rules.maxUsernameLength * 3) return { ok: false, reason: "too_long" };
  const key = rules.caseSensitive ? value : value.toLowerCase();
  const unusual = !rules.usernamePattern.test(rules.caseSensitive ? value.toLowerCase() : key);
  return { ok: true, display: value, key, unusual };
}

export function accountId(platform: Platform, key: string): string {
  return `${platform}:${key}`;
}

/**
 * Devuelve la URL solo si es https y pertenece a un dominio oficial de la
 * plataforma. Cualquier otra cosa (javascript:, dominios ajenos…) se descarta.
 */
export function sanitizeProfileUrl(platform: Platform, raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return undefined;
    if (!platformRules[platform].profileHosts.includes(url.hostname.toLowerCase())) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Extrae el nombre de usuario de una URL de perfil (p. ej. instagram.com/_u/ana). */
export function usernameFromProfileUrl(platform: Platform, raw: unknown): string | undefined {
  const safe = sanitizeProfileUrl(platform, raw);
  if (!safe) return undefined;
  const segments = new URL(safe).pathname.split("/").filter(Boolean);
  if (platform === "instagram") {
    const parts = segments[0] === "_u" ? segments.slice(1) : segments;
    return parts[0] ? decodeURIComponent(parts[0]) : undefined;
  }
  const handle = segments.find((s) => s.startsWith("@"));
  return handle ? decodeURIComponent(handle.slice(1)) : undefined;
}
